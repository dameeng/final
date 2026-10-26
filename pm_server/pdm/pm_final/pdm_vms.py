# -*- coding: utf-8 -*-
"""전광판(VMS) 예지보전: V8(5변수, 유형별 대표) + GMM, 0~100 점수 + 사유.

서비스에서 쓰는 함수: load_bundle(path), diagnose(bundle, equipment_id, df), build_baseline(df)
학습: python pdm_vms.py train --data <합성데이터 폴더> --out models/vms_model.joblib
"""
import json, argparse, sys
import numpy as np
import pandas as pd
import joblib
from pdm_common import make_anchors, to_risk, sustained, level_of

VARS = ["temp_gap", "ripple_v", "response_time_ms", "error_count", "bad_pixel_pct"]   # 열 / 전원 / 통신 / 통신 / 화면
RAW_COLS = ["temperature_c", "ambient_c", "ripple_v", "response_time_ms", "error_count", "bad_pixel_pct"]
N_CONSEC = 3                         # 연속 3시간 넘어야 높은 점수 (실험의 알림 규칙)
LAG_H, WIN_H, MIN_BASE_H = 7 * 24, 30 * 24, 10 * 24   # 평소 값 = 7일 전까지의 30일 (열화가 평소에 섞이지 않게 7일 지연)
MIN_ROWS = 24                        # 평균을 내려면 최근 24시간 필요 (12시간 미만이면 계산 안 함)
LIM = {"temperature_c": (-30, 80), "ambient_c": (-40, 60), "ripple_v": (0, 5), "response_time_ms": (0, 5000),
       "error_count": (0, 10000), "bad_pixel_pct": (0, 100)}
INFO = {   # 변수: (표시명, 단위, 고장 유형, 사유 문장 앞부분)
    "temp_gap": ("본체-외기 온도차", "℃", "thermal", "본체 온도가 외기보다 평소 이상으로"),
    "ripple_v": ("전원 리플", "V", "power", "전원 출력 떨림(리플)이 평소보다"),
    "response_time_ms": ("응답 시간", "ms", "comm", "통신 응답 시간이 평소보다"),
    "error_count": ("오류 횟수", "건", "comm", "통신 오류 횟수가 평소보다"),
    "bad_pixel_pct": ("불량 화소 비율", "%", "display", "화면 불량 화소가 평소보다"),
}


# ------------------------------------------------------------ 전처리 (학습·서비스 공용)
def clean(df):
    """중복 제거, 범위 밖 값은 빈 값으로 (채우지 않는다). 몇 개 지웠는지도 돌려준다."""
    d = df.copy()
    d["collected_at"] = pd.to_datetime(d["collected_at"])
    n0 = len(d)
    d = d.drop_duplicates(["collected_at"]).sort_values("collected_at")
    bad = 0
    for c, (lo, hi) in LIM.items():
        if c in d:
            m = (d[c] < lo) | (d[c] > hi)
            bad += int(m.sum())
            d.loc[m, c] = np.nan
    return d, dict(duplicates=n0 - len(d), out_of_range=bad)


def r24_of(d):
    """한 장비의 시간별 데이터 -> 5개 변수의 최근 24시간 평균 (시간 간격 1h로 맞춤, 빠진 시각은 빈 값)"""
    g = d.set_index("collected_at")[RAW_COLS].asfreq("1h")
    g["temp_gap"] = g.temperature_c - g.ambient_c
    return g[VARS].rolling(24, min_periods=12).mean()


def z_stored(r24, med, mad):
    """장비 자신의 평소 값(중앙값, MAD x 1.4826) 대비 robust z-score"""
    return (r24 - med) / (mad + 1e-6 + 0.02 * np.abs(med))


def baseline_at(r24, t0):
    """t0 시각 기준 평소 값: (t0-37일, t0-7일] 구간 24시간 평균 값들의 중앙값과 MAD. 10일치 미만이면 None."""
    w = r24[(r24.index > t0 - pd.Timedelta(hours=LAG_H + WIN_H)) & (r24.index <= t0 - pd.Timedelta(hours=LAG_H))]
    med, mad = [], []
    for v in VARS:
        x = w[v].dropna().to_numpy()
        if len(x) < MIN_BASE_H:
            return None
        m = float(np.median(x))
        med.append(m); mad.append(float(np.median(np.abs(x - m)) * 1.4826))
    return dict(med=med, mad=mad)


def z_daily(r24):
    """하루에 한 번(자정) 평소 값을 새로 만들어 그날 하루 동안 쓰는 방식 (서비스와 똑같은 계산)"""
    z = pd.DataFrame(np.nan, index=r24.index, columns=VARS)
    for t0 in r24.index[r24.index.hour == 0]:
        b = baseline_at(r24, t0)
        if b is None:
            continue
        day = (r24.index >= t0) & (r24.index < t0 + pd.Timedelta(days=1))
        z.loc[day] = z_stored(r24.loc[day], pd.Series(b["med"], index=VARS), pd.Series(b["mad"], index=VARS)).to_numpy()
    return z


def build_baseline(df, now=None):
    """장비 1대의 최근 이력(권장 37일 이상, 1시간 간격)으로 오늘 쓸 '평소 값'을 만든다.
    하루에 한 번(또는 새 장비 등록 때) 돌려서 DB/설정에 저장해 두고 diagnose(baseline=...)에 넘긴다.
    10일치 미만이면 None."""
    d, _ = clean(df)
    r = r24_of(d)
    t0 = pd.Timestamp(now) if now is not None else r.index.max()
    return baseline_at(r, t0.floor("h"))


# ------------------------------------------------------------ 서비스
def load_bundle(path):
    return joblib.load(path)


def _scores(bundle, z):
    X = z[VARS].to_numpy(dtype=float)
    ok = np.isfinite(X).all(axis=1)
    raw = np.full(len(X), np.nan)
    if ok.any():
        Z = np.clip(bundle["scaler"].transform(X[ok]), -30, 30)
        raw[ok] = -bundle["model"].score_samples(Z)
    return raw


def diagnose(bundle, equipment_id, df, baseline=None, now=None):
    """장비 1대의 최근 시간별 데이터(최소 24시간) -> 점수·등급·사유.

    df 컬럼: collected_at, temperature_c, ambient_c, ripple_v, response_time_ms, error_count, bad_pixel_pct (빈 값은 NaN/None)
    반환: dict(equipment_id, status, risk_score, risk_level, suspected_cause, reasons, warnings, anomaly_raw)
    status: ok / baseline_pending / insufficient_history / insufficient_data / stale
    """
    out = dict(equipment_id=equipment_id, status="ok", risk_score=None, risk_level=None, suspected_cause=None,
               reasons=[], warnings=[], anomaly_raw=None)
    d, q = clean(df)
    base = baseline                                    # 1순위: 호출한 쪽이 넘겨준 오늘의 평소 값
    if base is None and len(d) >= LAG_H + MIN_BASE_H + 24:   # 2순위: 보낸 데이터가 충분히 길면 거기서 직접 계산
        base = baseline_at(r24_of(d), pd.Timestamp(d.collected_at.max()).floor("h"))
    if base is None:                                   # 3순위: 학습 때 저장해 둔 값 (임시)
        base = bundle["baseline"].get(equipment_id)
    if base is None:
        out["status"] = "baseline_pending"
        out["warnings"].append("이 장비는 평소 값(baseline)이 없어 점수를 내지 않아요. build_baseline 으로 만들어 넘겨주세요.")
        return out
    if q["duplicates"]:
        out["warnings"].append(f"중복 시각 {q['duplicates']}행 제거")
    if q["out_of_range"]:
        out["warnings"].append(f"범위 밖 값 {q['out_of_range']}개를 빈 값 처리")
    if len(d) < MIN_ROWS:
        out["status"] = "insufficient_history"
        return out
    if now is not None and (pd.Timestamp(now) - d.collected_at.max()) > pd.Timedelta(hours=3):
        out["status"] = "stale"
        return out
    med = pd.Series(base["med"], index=VARS)
    mad = pd.Series(base["mad"], index=VARS)
    r24 = r24_of(d)
    z = z_stored(r24, med, mad)
    raw = _scores(bundle, z)
    risk = to_risk(raw, bundle["anchors"])
    score = sustained(risk, N_CONSEC)
    if not np.isfinite(score):
        out["status"] = "insufficient_data"
        out["warnings"].append("최근 값이 비어 있어 특징값을 만들지 못했어요.")
        return out
    out["risk_score"] = round(score, 1)
    out["risk_level"] = level_of(score)
    out["anomaly_raw"] = float(raw[-1])
    zl = z.iloc[-1]
    rl = r24.iloc[-1]
    tot = float(np.abs(zl).sum()) or 1.0
    items = []
    for v in VARS:
        name, unit, cause, head = INFO[v]
        zv = float(zl[v])
        if abs(zv) < 2.0:                               # 평소 범위 안이면 사유로 올리지 않는다
            continue
        direction = "높아요" if zv > 0 else "낮아요"
        items.append(dict(항목=name, 센서=v, 현재=round(float(rl[v]), 3), 평소=round(float(med[v]), 3),
                          설명=f"{head} {direction} (평소 {med[v]:.2f}{unit} → 최근 24시간 평균 {rl[v]:.2f}{unit})",
                          영향도=round(100 * abs(zv) / tot), _cause=cause, _z=abs(zv)))
    items.sort(key=lambda t: -t["_z"])
    out["reasons"] = [{k: v for k, v in it.items() if not k.startswith("_")} for it in items[:3]]
    if items and score >= 40:
        out["suspected_cause"] = items[0]["_cause"]
    return out


# ------------------------------------------------------------ 학습
def train(data_dir, out_path, mode="daily", seed=0, budget=60):
    import bench_common as bc
    from sklearn.preprocessing import RobustScaler
    P = json.load(open(f"{data_dir}/split_periods.json"))
    d = pd.concat([pd.read_csv(f"{data_dir}/vms_{k}.csv", parse_dates=["collected_at"]) for k in ["train", "valid", "test"]],
                  ignore_index=True)
    t_end_train, t_end_valid = np.datetime64(P["train"][1]), np.datetime64(P["valid"][1])
    G, T, X, R24 = [], [], [], []
    base = {}
    for eq, g in d.groupby("equipment_id"):
        gc, _ = clean(g)
        r = r24_of(gc)
        b0 = baseline_at(r, pd.Timestamp(P["valid"][1]).floor("h"))      # 번들에 임시로 넣어 두는 값 (검증 구간 끝 기준)
        if b0 is not None:
            base[eq] = b0
        if mode == "daily":
            z = z_daily(r)
        else:                                          # 비교용: 학습 구간 고정 평소 값
            tr = r[r.index <= pd.Timestamp(P["train"][1])]
            med = tr.median(); mad = (tr - med).abs().median() * 1.4826
            z = z_stored(r, med, mad)
        G.append(np.full(len(z), eq)); T.append(z.index.to_numpy()); X.append(z[VARS].to_numpy(dtype=np.float64)); R24.append(r.to_numpy())
    X, G, T = np.vstack(X), np.concatenate(G), np.concatenate(T)
    split = np.where(T <= t_end_train, "train", np.where(T <= t_end_valid, "valid", "test"))
    lay = bc.Layout(G, T, split)
    tr_idx = np.where(split == "train")[0]
    Xtr = X[tr_idx]; Xtr = Xtr[np.isfinite(Xtr).all(axis=1)]
    sc = RobustScaler().fit(Xtr)
    Ztr = np.clip(sc.transform(Xtr), -30, 30).astype(np.float32)
    rng = np.random.default_rng(seed)
    if len(Ztr) > 60000:
        Ztr = Ztr[rng.choice(len(Ztr), 60000, replace=False)]
    gm = bc.GMM(seed).fit(Ztr).m
    ok = np.isfinite(X).all(axis=1) & (split != "train")
    raw = np.full(len(X), np.nan, dtype=np.float32)
    ii = np.where(ok)[0]
    raw[ii] = -gm.score_samples(np.clip(sc.transform(X[ii]), -30, 30))
    thr, k = bc.pick_threshold(raw, lay, N_CONSEC, budget)
    vmask = split == "valid"
    anchors = make_anchors(raw[vmask], thr)
    bundle = dict(version="vms-v8-gmm-1", vars=VARS, raw_cols=RAW_COLS, scaler=sc, model=gm, baseline=base, anchors=anchors,
                  n_consec=N_CONSEC, baseline_mode=mode, period="1h", window_h=24,
                  note="합성 데이터로 학습. 시연·개발용. 실제 데이터로 재학습 전까지 성능 수치는 참고치.")
    if out_path:
        joblib.dump(bundle, out_path)
    # ---- 검증: 시험 구간
    risk = np.full(len(X), np.nan)
    risk[ok] = to_risk(raw[ok], anchors)
    sm = np.full(len(X), np.nan)
    for _, lo, hi in lay.blocks["test"] + lay.blocks["valid"]:
        r = risk[lo:hi]
        w = np.lib.stride_tricks.sliding_window_view(np.concatenate([[np.nan] * (N_CONSEC - 1), r]), N_CONSEC)
        sm[lo:hi] = np.where(np.isfinite(w).all(axis=1), w.min(axis=1), np.nan)
    ev = pd.read_csv(f"{data_dir}/vms_events.csv", parse_dates=["degradation_start", "end"])
    ev = ev[ev.split == "test"].rename(columns={"equipment_id": "group", "degradation_start": "start"})
    cfg = dict(n_consec=N_CONSEC, fa_pad=((1, "D"), (3, "D")), detect_post=(0, "h"), lead_mode="lead",
               test_group_months=180, valid_budget_count=budget, ap_skip=0.25, fa_budget_test=0.25)
    met = bc.evaluate(raw, lay, ev, cfg, thr)
    return bundle, dict(raw=raw, risk=sm, lay=lay, events=ev, metrics=met, thr=thr, valid_alerts=k, X=X, G=G, T=T, split=split)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["train"])
    ap.add_argument("--data", required=True)
    ap.add_argument("--out", default="models/vms_model.joblib")
    ap.add_argument("--mode", default="daily", choices=["daily", "fixed"])
    a = ap.parse_args()
    b, info = train(a.data, a.out, a.mode)
    m = info["metrics"]
    print(json.dumps({k: m[k] for k in ["n_events", "recall", "fa_per_gm", "recall_oracle", "ap", "auc", "median_delay", "per_type"]}, ensure_ascii=False, indent=1))
    print("anchors", {k: (round(v, 4) if isinstance(v, float) else v) for k, v in b["anchors"].items() if k != "y"})
