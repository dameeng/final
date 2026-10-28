# -*- coding: utf-8 -*-
"""CCTV·배수펌프 진단 공통 (팀원 수위계·전광판 모델과 같은 방식·같은 출력).

방식 (pm_final 의 pdm_wl.py · pdm_vms.py 와 같게)
  - 특징: 최근 N개 측정값에서 3~5개 (features.py)
  - 모델: RobustScaler -> ±30 자르기 -> IsolationForest(200개), 이상 점수 = -score_samples
  - 점수: pdm_common.to_risk (0 = 정상 1%, 20 = 정상 중앙, 40 = 정상 99%, 70 = 알림 기준, 100) + 연속 n번 조건(sustained)
  - 70점 알림 기준: 검증 구간(깨끗한 정상)에서 헛알림 묶음이 예산 이하가 되는 가장 낮은 값
  - 학습 / 검증 / 시험을 기간으로 나눠요 (시험 기간은 학습·기준 정하기에 안 씀)
출력 (diagnose)
  equipment_id, status, risk_score, risk_level, health_index, suspected_cause, reasons[{항목,센서,현재,평소,설명,영향도}],
  warnings, anomaly_raw (+ 종류별 추가 키: 펌프 sensors)

팀원 모델과 다른 점: 팀원 모델은 시각 간격을 맞춰(asfreq) 계산하지만, 여기는 '최근 N개' 기준이에요.
측정 간격이 일정하면 결과는 같아요. 빠진 시각이 있으면 그 앞뒤 값을 이어서 계산해요.
"""
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import RobustScaler

from .teammate import level_of, make_anchors, sustained, to_risk
from .features import SPECS, metrics_of, sliding, window_of, zscores

REASON_Z = 3.0            # 평소 대비 편차(robust z)가 이보다 작으면 사유로 올리지 않아요 (팀원 수위계와 같음)
MAX_REASONS = 3
SAFE_TEXT = "모든 센서가 평소와 비슷해요"


# ------------------------------------------------------------ 점수 (학습·서비스 공용)
def raw_scores(bundle, X):
    """특징 행렬 -> 이상 점수 (클수록 이상). 빈 값이 있는 행은 NaN"""
    X = np.asarray(X, dtype=float).reshape(-1, len(bundle["feats"]))
    raw = np.full(len(X), np.nan)
    ok = np.isfinite(X).all(axis=1)
    if ok.any():
        raw[ok] = -bundle["model"].score_samples(np.clip(bundle["scaler"].transform(X[ok]), -30, 30))
    return raw



def need_rows(etype, n_consec):
    """점수 하나에 필요한 최근 측정 수 = 창 + 연속 조건 - 1"""
    return window_of(etype) + n_consec - 1


# ------------------------------------------------------------ 전처리
def clean(etype, df, time_col="collected_at"):
    """시각 순서 정렬, 중복 시각 제거, 범위 밖 값은 빈 값으로 (채우지 않음) -> (wide, 경고 목록)"""
    d = df.copy()
    if time_col in d.columns:
        d[time_col] = pd.to_datetime(d[time_col])
        d = d.set_index(time_col)
    d = d.sort_index()
    warnings = []
    dup = int(d.index.duplicated(keep="last").sum())
    if dup:
        d = d[~d.index.duplicated(keep="last")]
        warnings.append("중복 시각 %d행 제거" % dup)
    missing = [m for m in metrics_of(etype) if m not in d.columns]
    if missing:
        raise ValueError("센서 항목이 없어요: %s" % ", ".join(missing))
    d = d[metrics_of(etype)].apply(pd.to_numeric, errors="coerce")
    bad = 0
    for m, (_, _, (lo, hi), _) in SPECS[etype]["metrics"].items():
        mask = ((d[m] < lo) if lo is not None else False) | ((d[m] > hi) if hi is not None else False)
        bad += int(np.sum(mask))
        d.loc[mask, m] = np.nan
    if bad:
        warnings.append("범위 밖 값 %d개를 빈 값 처리" % bad)
    return d, warnings


# ------------------------------------------------------------ 사유
def build_result(cfg, bundle, equip_id, feats_last, score, raw_last, w, zmean, warnings):
    """점수가 정해진 뒤 사유·의심 원인·추가 키를 만들어요. w = 마지막 창의 측정값, zmean = 창 안 센서별 z 평균"""
    etype = cfg.ETYPE
    out = dict(equipment_id=equip_id, status="ok", risk_score=round(float(score), 1), risk_level=level_of(score),
               health_index=round(100 - float(score), 1), suspected_cause=None, reasons=[], warnings=warnings,
               anomaly_raw=None if raw_last is None or not np.isfinite(raw_last) else float(raw_last))
    zl = np.clip(bundle["scaler"].transform(np.asarray(feats_last, dtype=float).reshape(1, -1)), -30, 30)[0]
    bad = np.array([-z if d == "down" else z if d == "up" else abs(z) for z, d in zip(zl, bundle["dirs"])])
    pos = np.clip(bad, 0, None)
    tot = float(pos.sum()) or 1.0
    items = []
    for i in np.argsort(-pos)[:MAX_REASONS]:
        if pos[i] < REASON_Z:                              # 평소 범위 안이면 사유로 올리지 않는다
            continue
        key, name, source, stat, _ = SPECS[etype]["features"][i]
        sensors, cause = cfg.reason_sensors(key, source, zmean)
        cur, usual = float(feats_last[i]), float(bundle["normal_median"][i])
        unit = cfg.UNITS.get(key, "")
        word = "높아요" if zl[i] > 0 else "낮아요"
        items.append(dict(항목=name, 센서=sensors, 현재=round(cur, 3), 평소=round(usual, 3),
                          설명="%s %s (평소 %s%s → 지금 %s%s)" % (cfg.DESC[key], word, _fmt(usual), unit, _fmt(cur), unit),
                          영향도=round(100 * pos[i] / tot), _cause=cause))
    if items and score >= 40:
        out["suspected_cause"] = items[0]["_cause"]
    out["reasons"] = [{k: v for k, v in it.items() if not k.startswith("_")} for it in items]
    out.update(cfg.extra(bundle, w, zmean))
    return out


def diagnose(cfg, bundle, equip_id, df, now=None):
    """설비 1대의 최근 측정값 -> 점수·등급·사유 (팀원 diagnose 와 같은 모양)"""
    etype, n = cfg.ETYPE, bundle["n_consec"]
    out = dict(equipment_id=equip_id, status="ok", risk_score=None, risk_level=None, health_index=None,
               suspected_cause=None, reasons=[], warnings=[], anomaly_raw=None)
    try:
        d, warnings = clean(etype, df)
    except ValueError as e:
        out.update(status="insufficient_data", warnings=[str(e)])
        return out
    out["warnings"] = warnings
    if len(d) and now is not None and (pd.Timestamp(now) - d.index.max()) > pd.Timedelta(seconds=cfg.STALE_SEC):
        out["status"] = "stale"
        return out
    w = d.dropna().tail(need_rows(etype, n))
    if len(w) < need_rows(etype, n):
        out["status"] = "insufficient_history"
        out["warnings"].append("최근 측정값이 %d개 필요한데 %d개뿐이에요" % (need_rows(etype, n), len(w)))
        return out
    X, _ = sliding(etype, w, baseline=bundle["baseline"])          # 창 n개
    raw = raw_scores(bundle, X)
    score = sustained(to_risk(raw, bundle["anchors"]), n)
    if not np.isfinite(score):
        out["status"] = "insufficient_data"
        out["warnings"].append("최근 값이 비어 있어 특징값을 만들지 못했어요.")
        return out
    last = w.tail(window_of(etype))
    return build_result(cfg, bundle, equip_id, X[-1], score, raw[-1], last,
                        zscores(etype, last, bundle["baseline"]).mean(), out["warnings"])


# ------------------------------------------------------------ 학습 (팀원 bench_common 의 헛알림 세는 방식과 같게)
def _run_state(a, n):
    """n번 연속 True 인 칸만 True (알림 상태)"""
    if n <= 1:
        return a
    idx = np.arange(len(a))
    last0 = np.maximum.accumulate(np.where(~a, idx, -1))
    return a & ((idx - last0) >= n)


def _episodes(raw, groups, n, thr, mask=None):
    """알림 묶음 수 (알림 상태로 바뀌는 순간 수). groups = 설비별로 이어진 [시작, 끝) 목록, mask = 셀 칸만"""
    c = 0
    for lo, hi in groups:
        st = _run_state(np.nan_to_num(raw[lo:hi], nan=-np.inf) > thr, n)
        rise = st & ~np.concatenate([[False], st[:-1]])
        if mask is not None:
            rise &= mask[lo:hi]
        c += int(rise.sum())
    return c


def pick_threshold(raw, groups, n, budget, mask=None):
    """검증 구간(깨끗한 정상)에서 헛알림 묶음이 예산 이하가 되는 가장 낮은 임계값 (이분 탐색)"""
    v = np.concatenate([raw[lo:hi] for lo, hi in groups])
    v = v[np.isfinite(v)]
    qs = 1 - np.logspace(-0.7, -5.5, 300)
    cands = np.unique(np.concatenate([np.quantile(v, qs), np.sort(v)[-300:]]))
    cnt = lambda thr: _episodes(raw, groups, n, thr, mask)  # noqa: E731
    lo, hi = 0, len(cands) - 1
    if cnt(cands[hi]) > budget:
        return float(cands[hi]), cnt(cands[hi])
    while lo < hi:
        mid = (lo + hi) // 2
        if cnt(cands[mid]) <= budget:
            hi = mid
        else:
            lo = mid + 1
    return float(cands[lo]), cnt(cands[lo])


def fit(etype, baseline, X_train, X_valid_clean, valid_raw_fn, n_consec, budget, seed=0):
    """학습 구간으로 스케일러·모델, 검증 구간으로 알림 기준·눈금.
    baseline = 센서별 평소 평균·표준편차 (학습 구간), valid_raw_fn(bundle) -> (이상 점수, 설비별 구간, 깨끗한 정상 표시) 검증 구간"""
    Xtr = X_train[np.isfinite(X_train).all(axis=1)]
    sc = RobustScaler().fit(Xtr)
    Z = np.clip(sc.transform(Xtr), -30, 30).astype(np.float32)
    if len(Z) > 60000:
        Z = Z[np.random.default_rng(seed).choice(len(Z), 60000, replace=False)]
    model = IsolationForest(n_estimators=200, random_state=seed, n_jobs=1).fit(Z)
    dirs = [f[4] for f in SPECS[etype]["features"]]
    bundle = dict(feats=[f[0] for f in SPECS[etype]["features"]], dirs=dirs, scaler=sc, model=model, n_consec=n_consec,
                  baseline=baseline,
                  normal_median=[float(v) for v in np.nanmedian(X_valid_clean, axis=0)])
    raw, groups, mask = valid_raw_fn(bundle)
    thr, k = pick_threshold(raw, groups, n_consec, budget, mask)
    clean_raw = np.concatenate([raw[lo:hi][mask[lo:hi]] for lo, hi in groups])
    bundle["anchors"] = make_anchors(clean_raw, thr)
    bundle["valid_alerts"] = k
    return bundle


def _fmt(v):
    return ("%.3f" % v).rstrip("0").rstrip(".") if abs(v) < 10 else "%.1f" % v
