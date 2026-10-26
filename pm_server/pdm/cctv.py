# -*- coding: utf-8 -*-
"""CCTV 예지보전 (팀원 수위계·전광판 모델과 같은 방식·같은 출력, 공통 부분은 diag.py).

입력: CCTV 1대의 시간별 센서 4개 (영상 수신률 · 응답 시간 · 패킷 손실률 · 화면 흐림), 최근 14개 (= 창 12 + 연속 3 - 1)
특징: 수신률 평균 · 응답 시간 평균 · 응답 시간 증가 추세 · 패킷 손실률 평균 · 화면 흐림 최대 (features.py)
연속 3번(3시간) 넘어야 높은 점수. 의심 원인(suspected_cause): comm(통신) / video(화면)

서비스: diagnose(bundle, equipment_id, df)   df 컬럼: collected_at + 센서 4개 (빈 값은 NaN)
학습:   train() -> (bundle, 검증 결과)   기간: 학습 1~2월 · 검증 3월 · 시험 4월 (data/cctv_sample.csv)
"""
import sys

import numpy as np
import pandas as pd

from . import diag, samples
from .teammate import to_risk
from .features import baseline_of, metric_ko, metrics_of, sliding, window_of

ETYPE = "CCTV"
N_CONSEC = 3                 # 연속 3번(3시간)
BUDGET_PER_GM = 0.5          # 알림 기준: 검증 구간 헛알림 묶음 = 설비·월 0.5건 (1.0 이면 시험 헛알림 1.2건, 0.5 면 0.46건. 2026-10-24)
STALE_SEC = 3 * 3600         # now 를 넘겼을 때 최신 측정이 3시간보다 오래되면 stale
SPLIT = ("2026-03-01", "2026-04-01")      # 학습 < 3/1 <= 검증 < 4/1 <= 시험
# 고장 14일 전 ~ 고장 12시간 뒤 = 고장 구간 (깨끗한 정상에서 빼고, 시험에서 이 안에 70점이 되면 탐지)
# 샘플 데이터는 고장 2~3주 전부터 서서히 나빠져요. 7일로 잡으면 그 앞부분이 '정상'으로 세어져 헛알림이 2배로 보여요
FAULT_BEFORE, FAULT_AFTER = pd.Timedelta(days=14), pd.Timedelta(hours=12)

DESC = {
    "receive_mean": "영상 수신률이 평소보다",
    "response_mean": "응답 시간이 평소보다",
    "response_trend": "응답 시간이 늘어나는 속도가 평소보다",
    "loss_mean": "패킷 손실률이 평소보다",
    "blur_max": "화면 흐림이 평소보다",
}
UNITS = {"receive_mean": "%", "response_mean": "ms", "response_trend": "ms/시간", "loss_mean": "%", "blur_max": "점"}
CAUSE = {"receive_mean": "comm", "response_mean": "comm", "response_trend": "comm", "loss_mean": "comm", "blur_max": "video"}
SOURCE = {"receive_mean": "video_receive_rate", "response_mean": "response_time_ms", "response_trend": "response_time_ms",
          "loss_mean": "packet_loss_rate", "blur_max": "image_blur_score"}


def reason_sensors(key, source, zmean):
    return metric_ko(ETYPE, SOURCE[key]), CAUSE[key]


def extra(bundle, w, zmean):
    return {}


def diagnose(bundle, equipment_id, df, now=None):
    return diag.diagnose(sys.modules[__name__], bundle, equipment_id, df, now)


# ------------------------------------------------------------ 학습
def _load():
    """설비별 시간 순서 특징 + 창 끝 시각·고장 표시"""
    d = pd.read_csv(samples.CCTV_CSV, encoding="utf-8-sig", parse_dates=["collected_at"])
    d = d.sort_values(["equipment_id", "collected_at"]).reset_index(drop=True)
    cols = metrics_of(ETYPE)
    d[cols] = d[cols].astype(float).round(3)
    t1 = pd.Timestamp(SPLIT[0])
    base = baseline_of(ETYPE, [d[(d.collected_at < t1) & (d.risk_level == "정상")][cols]])
    X, T, G, F, EV = [], [], [], [], []
    for eid, g in d.groupby("equipment_id", sort=True):
        g = g.reset_index(drop=True)
        x, ends = sliding(ETYPE, g[cols], baseline=base)
        t = g.collected_at.to_numpy()[ends]
        fail_t = g.collected_at[g.failure_event == 1].tolist()
        fault = np.zeros(len(t), bool)
        for f in fail_t:
            fault |= (t >= np.datetime64(f - FAULT_BEFORE)) & (t <= np.datetime64(f + FAULT_AFTER))
            EV.append((eid, f))
        X.append(x); T.append(t); G.append(np.full(len(t), eid)); F.append(fault)
    return base, np.vstack(X), np.concatenate(T), np.concatenate(G), np.concatenate(F), EV


def _groups(G, mask):
    """mask 인 행들을 설비별로 이어진 [시작, 끝) 구간으로"""
    out = []
    idx = np.where(mask)[0]
    if not len(idx):
        return out
    cut = np.where((np.diff(idx) != 1) | (G[idx][1:] != G[idx][:-1]))[0] + 1
    for a, b in zip(np.concatenate([[0], cut]), np.concatenate([cut, [len(idx)]])):
        out.append((int(idx[a]), int(idx[b - 1]) + 1))
    return out


def train(seed=0):
    base, X, T, G, F, EV = _load()
    t1, t2 = np.datetime64(SPLIT[0]), np.datetime64(SPLIT[1])
    split = np.where(T < t1, "train", np.where(T < t2, "valid", "test"))
    n_dev = len(np.unique(G))
    valid_months = (t2 - t1) / np.timedelta64(30, "D")
    vgroups = _groups(G, split == "valid")

    def valid_raw(bundle):
        return diag.raw_scores(bundle, X), vgroups, ~F

    bundle = diag.fit(ETYPE, base, X[split == "train"], X[(split == "valid") & ~F], valid_raw, N_CONSEC,
                      budget=BUDGET_PER_GM * n_dev * valid_months, seed=seed)
    bundle.update(version="cctv-if-1", period="1h", window=window_of(ETYPE), split=SPLIT,
                  note="합성 데이터(cctv_sample.csv)로 학습. 시연·개발용. 실제 데이터로 재학습 전까지 수치는 참고치.")
    return bundle, evaluate(bundle, X, T, G, F, EV, split)


def evaluate(bundle, X, T, G, F, EV, split):
    """시험 구간(4월): 고장 14일 전 ~ 고장 사이에 70점 이상이 되었나, 몇 일 전에, 헛알림은 얼마나"""
    raw = diag.raw_scores(bundle, X)
    risk = to_risk(raw, bundle["anchors"])
    n = bundle["n_consec"]
    sm = np.full(len(X), np.nan)
    tg = _groups(G, split == "test")
    for lo, hi in tg:
        w = np.lib.stride_tricks.sliding_window_view(np.concatenate([[np.nan] * (n - 1), risk[lo:hi]]), n)
        sm[lo:hi] = np.where(np.isfinite(w).all(axis=1), w.min(axis=1), np.nan)
    test = split == "test"
    res = {"normal_rows_ge40": float((sm[test & ~F] >= 40).mean()), "normal_rows_ge70": float((sm[test & ~F] >= 70).mean())}
    found40, found70, leads = [], [], []
    for eid, f in EV:
        if not (np.datetime64(SPLIT[1]) <= np.datetime64(f)):
            continue
        m = (G == eid) & (T >= np.datetime64(f - FAULT_BEFORE)) & (T <= np.datetime64(f))
        s = sm[m]
        found40.append(bool(np.nanmax(s) >= 40) if np.isfinite(s).any() else False)
        hit = np.where(s >= 70)[0]
        found70.append(len(hit) > 0)
        if len(hit):
            leads.append(float((np.datetime64(f) - T[m][hit[0]]) / np.timedelta64(1, "D")))
    fa = 0
    for lo, hi in tg:
        st = sm[lo:hi] >= 70
        rise = st & ~np.concatenate([[False], st[:-1]])
        fa += int((rise & ~F[lo:hi]).sum())
    n_dev = len(np.unique(G))
    res.update(n_events=len(found70), recall70=float(np.mean(found70)), recall40=float(np.mean(found40)),
               median_lead_days=float(np.median(leads)) if leads else None,
               false_alarms=fa, false_alarms_per_device_month=round(fa / n_dev, 3), valid_alerts=bundle["valid_alerts"])
    return res
