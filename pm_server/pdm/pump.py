# -*- coding: utf-8 -*-
"""배수펌프 예지보전 (팀원 수위계·전광판 모델과 같은 방식·같은 출력, 공통 부분은 diag.py).

입력: 펌프 1대의 10초 간격 센서 6개 (진동 · 압력 · 온도 · 전류 · 유량 · 회전수), 최근 35개 (= 창 30 + 연속 6 - 1)
특징: 진동 이상 정도 · 진동 변동성 · 압력 이상 정도 · 온도 변화 추세 · 평소 범위를 벗어난 센서 비율 (features.py)
연속 6번(1분) 넘어야 높은 점수. 사유의 '센서' 칸에 센서 이름, 의심 원인(suspected_cause)은 센서 종류
(vibration · pressure · temperature · current · flow · rpm). 추가 키 sensors: 센서 6개 각각의 현재·평소·벗어난 정도

서비스: diagnose(bundle, equipment_id, df)   df 컬럼: collected_at + 센서 6개 (빈 값은 NaN)
학습:   train() -> (bundle, 검증 결과)   기간: 학습 6/21 · 검증 6/22~6/23 18시 · 시험 정상 ~6/24 12시, 그 뒤 고장 전조~고장 (data/pump_sample_10s.csv)
한계: 펌프 1대 · 8일 · 고장 1건뿐이라 평가가 약해요. 시험 정상 구간에도 이미 온도가 내려가는 조짐이 있어요
"""
import sys

import numpy as np
import pandas as pd

from . import diag, samples
from .teammate import to_risk
from .features import OUT_Z, PUMP_SENSORS, baseline_of, metric_ko, metrics_of, sliding, window_of

ETYPE = "PUMP"
N_CONSEC = 6                 # 연속 6번(1분)
BUDGET = 0                   # 알림 기준: 검증 구간(1.5일, 깨끗한 정상)에서 헛알림 0건 (펌프가 1대라 '설비·월' 예산을 못 써요)
STALE_SEC = 60               # now 를 넘겼을 때 최신 측정이 1분보다 오래되면 stale
SPLIT = ("2018-06-22 00:00", "2018-06-23 18:00")     # 학습 < 6/22 <= 검증 < 6/23 18시 <= 시험
# 검증을 길게(6/23 낮 압력·회전수 출렁임 포함) 잡아야 시험 정상 구간 헛알림이 줄어요 (2026-10-24 비교: 학습 1.5일 16회 -> 1일 4회)
FAULT_START = pd.Timestamp("2018-06-24 12:00")       # 고장 전조 시작 (원본 sensor_00·04 가 내려가기 시작. 그 전 18시간이 시험용 정상)
BROKEN_AT = pd.Timestamp("2018-06-28 22:00")         # 원본 machine_status = BROKEN

GROUP_OF = {g: (m, ko) for g, m, ko, _ in PUMP_SENSORS}                     # vib -> (vibration, 진동센서)
DESC = {
    "vib_level": "진동센서 값이 평소 흔들림 대비 벗어난 정도가 평소보다",
    "vib_vol": "진동센서 값의 흔들림이 평소보다",
    "press_level": "압력센서 값이 평소 흔들림 대비 벗어난 정도가 평소보다",
    "temp_trend": "온도센서 값이 변하는 속도가 평소보다",
    "out_share": "평소 범위를 벗어난 센서 비율이 평소보다",
}
UNITS = {"vib_level": "배", "vib_vol": "배", "press_level": "배", "temp_trend": "", "out_share": "%"}


def reason_sensors(key, source, zmean):
    """사유의 센서 이름과 의심 원인"""
    if source.startswith("g:"):
        m, ko = GROUP_OF[source[2:]]
        return ko, m
    out = zmean.abs().sort_values(ascending=False)          # 'out' = 평소 범위를 벗어난 센서들
    names = [m for m in out.index if out[m] >= OUT_Z]
    if not names:
        names = [out.index[0]]
    return "·".join(metric_ko(ETYPE, m) for m in names), names[0]


def extra(bundle, w, zmean):
    """센서 6개 각각의 현재값·평소값·벗어난 정도 (화면에 센서별로 보여줄 때)"""
    last = w.iloc[-1]
    base = bundle["baseline"]
    return {"sensors": [dict(센서=metric_ko(ETYPE, m), 항목=m, 현재=round(float(last[m]), 3),
                             평소=round(float(base["mu"][m]), 3), 벗어난정도=round(float(zmean[m]), 2),
                             상태="평소와 달라요" if abs(zmean[m]) >= OUT_Z else "정상")
                        for m in metrics_of(ETYPE)]}


def diagnose(bundle, equipment_id, df, now=None):
    return diag.diagnose(sys.modules[__name__], bundle, equipment_id, df, now)


# ------------------------------------------------------------ 학습
def train(seed=0):
    d = samples.pump_10s()
    cols = metrics_of(ETYPE)
    t1, t2 = pd.Timestamp(SPLIT[0]), pd.Timestamp(SPLIT[1])
    base = baseline_of(ETYPE, [d[d.timestamp < t1][cols]])
    X, ends = sliding(ETYPE, d[cols], baseline=base)
    T = d.timestamp.to_numpy()[ends]
    split = np.where(T < np.datetime64(t1), "train", np.where(T < np.datetime64(t2), "valid", "test"))
    v = np.where(split == "valid")[0]
    vgroups = [(int(v[0]), int(v[-1]) + 1)]
    clean = np.ones(len(X), bool)

    def valid_raw(bundle):
        return diag.raw_scores(bundle, X), vgroups, clean

    bundle = diag.fit(ETYPE, base, X[split == "train"], X[split == "valid"], valid_raw, N_CONSEC, budget=BUDGET, seed=seed)
    bundle.update(version="pump-if-1", period="10s", window=window_of(ETYPE), split=SPLIT,
                  note="펌프 시연 CSV(1분)를 10초로 가공한 합성 데이터로 학습. 시연·개발용. 실제 데이터로 재학습 전까지 수치는 참고치.")
    return bundle, evaluate(bundle, X, T, split)


def evaluate(bundle, X, T, split):
    """시험 구간: 고장 전조 전(6/23 18시~6/24 12시)은 헛알림, 전조 뒤에는 고장(6/28 22시) 몇 시간 전에 70점이 되었나"""
    risk = to_risk(diag.raw_scores(bundle, X), bundle["anchors"])
    n = bundle["n_consec"]
    w = np.lib.stride_tricks.sliding_window_view(np.concatenate([[np.nan] * (n - 1), risk]), n)
    sm = np.where(np.isfinite(w).all(axis=1), w.min(axis=1), np.nan)
    test = split == "test"
    before = test & (T < np.datetime64(FAULT_START))
    st = sm[before] >= 70
    fa = int((st & ~np.concatenate([[False], st[:-1]])).sum())
    res = {"normal_rows_ge40": float((sm[before] >= 40).mean()), "normal_rows_ge70": float((sm[before] >= 70).mean()),
           "false_alarms_before_fault": fa}
    for lv in (40, 70):
        hit = np.where(test & (T >= np.datetime64(FAULT_START)) & (T <= np.datetime64(BROKEN_AT)) & (sm >= lv))[0]
        res["first_%d" % lv] = str(pd.Timestamp(T[hit[0]])) if len(hit) else None
        res["lead_hours_%d" % lv] = round(float((np.datetime64(BROKEN_AT) - T[hit[0]]) / np.timedelta64(1, "h")), 1) if len(hit) else None
    res["valid_alerts"] = bundle["valid_alerts"]
    return res
