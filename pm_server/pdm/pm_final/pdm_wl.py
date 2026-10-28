# -*- coding: utf-8 -*-
"""수위계 예지보전(센서 이상 탐지): W4(추세 제거 잔차 5개) + IsolationForest, 0~100 점수 + 사유.

* 침수 위험 예측이 아니라 '수위계가 고장·오작동인지' 보는 모델이에요.
* 입력은 5분 간격 수위(level_m). 센서마다 따로 계산하고, 모델은 센서 7개가 공용 1개를 써요.

서비스에서 쓰는 함수: load_bundle(path), diagnose(bundle, sensor_id, df)
학습: python pdm_wl.py train --data <합성데이터 폴더> --out models/wl_model.joblib
"""
import json, argparse
import numpy as np
import pandas as pd
import joblib
from pdm_common import make_anchors, to_risk, sustained, level_of

STEP = "5min"
N_CONSEC = 2                      # 연속 2번(10분) 넘어야 높은 점수 (실험의 알림 규칙)
MIN_ROWS = 300                    # 24시간 기울기를 만들려면 최소 24시간(288개) + 여유 필요
FEATS = ["res_max3", "res_max12", "res_sd12", "slope_dev", "slope24"]
INFO = {   # 특징: (표시명, 유형)
    "res_max3": ("최근 15분 최대 이탈폭", "급변(스파이크·스텝)"),
    "res_max12": ("최근 1시간 최대 이탈폭", "지속 이탈"),
    "res_sd12": ("최근 1시간 흔들림", "노이즈 증가"),
    "slope_dev": ("1시간 기울기와 6시간 기울기 차이", "추세 꺾임"),
    "slope24": ("24시간 기울기", "드리프트"),
}
DESC = {
    "res_max3": "수위가 직전 6시간 중앙값에서 최근 15분 사이 평소보다 크게 벗어났어요",
    "res_max12": "수위가 직전 6시간 중앙값에서 최근 1시간 동안 평소보다 크게 벗어나 있어요",
    "res_sd12": "최근 1시간 수위가 평소보다 많이 흔들려요",
    "slope_dev": "수위가 오르내리는 속도가 최근 1시간과 6시간 사이에 평소보다 크게 달라졌어요",
    "slope24": "최근 24시간 동안 수위가 한 방향으로 평소보다 빠르게 움직였어요",
}


# ------------------------------------------------------------ 전처리 (학습·서비스 공용)
def clean(df, lim=None):
    d = df.copy()
    d["observed_at"] = pd.to_datetime(d["observed_at"])
    n0 = len(d)
    d = d.drop_duplicates(["observed_at"]).sort_values("observed_at")
    bad = 0
    if lim is not None:
        m = (d.level_m < lim[0]) | (d.level_m > lim[1])
        bad = int(m.sum())
        d.loc[m, "level_m"] = np.nan
    return d, dict(duplicates=n0 - len(d), out_of_range=bad)


def features(x):
    """x: 5분 간격 수위 Series (빠진 시각은 NaN). W4: 직전 6시간 중앙값을 뺀 잔차와 기울기 (센서 자신의 평소 변동폭으로 나눔)"""
    d1 = x.diff()
    ad = d1.abs()
    s = np.maximum(np.maximum(ad.rolling(288, min_periods=72).median(), 0.5 * ad.rolling(288, min_periods=72).mean()), 0.0003).shift(1)
    sf = np.maximum(s, 0.001)
    R = lambda ser, w, f: getattr(ser.rolling(w, min_periods=max(2, w // 2)), f)()
    med = x.rolling(72, min_periods=36).median().shift(1)
    r = x - med
    rs = r.rolling(288, min_periods=72).std().shift(1) + 1e-3
    sl1, sl6, sl24 = (x - x.shift(12)) / 12, (x - x.shift(72)) / 72, (x - x.shift(288)) / 288
    return pd.DataFrame({"res_max3": R(r.abs(), 3, "max") / rs, "res_max12": R(r.abs(), 12, "max") / rs,
                         "res_sd12": R(r, 12, "std") / rs, "slope_dev": (sl1 - sl6).abs() / sf, "slope24": sl24.abs() / sf})


# ------------------------------------------------------------ 서비스
def load_bundle(path):
    return joblib.load(path)


def diagnose(bundle, sensor_id, df, now=None):
    """수위계 1개의 최근 5분 간격 수위(권장 2일 이상) -> 점수·등급·사유.
    df 컬럼: observed_at, level_m (빈 값은 NaN/None, 채우지 말 것)
    반환: dict(sensor_id, status, risk_score, risk_level, anomaly_type, reasons, warnings, anomaly_raw)
    status: ok / insufficient_history / insufficient_data / stale
    """
    out = dict(sensor_id=sensor_id, status="ok", risk_score=None, risk_level=None, anomaly_type=None,
               reasons=[], warnings=[], anomaly_raw=None)
    d, q = clean(df, bundle["lim"])
    if q["duplicates"]:
        out["warnings"].append(f"중복 시각 {q['duplicates']}행 제거")
    if q["out_of_range"]:
        out["warnings"].append(f"범위 밖 값 {q['out_of_range']}개를 빈 값 처리")
    if d.level_m.notna().sum() < MIN_ROWS:
        out["status"] = "insufficient_history"
        return out
    if now is not None and (pd.Timestamp(now) - d.observed_at.max()) > pd.Timedelta(minutes=30):
        out["status"] = "stale"
        return out
    x = d.set_index("observed_at").level_m.asfreq(STEP)
    F = features(x)
    X = F[FEATS].to_numpy(dtype=float)
    ok = np.isfinite(X).all(axis=1)
    raw = np.full(len(X), np.nan)
    if ok.any():
        Z = np.clip(bundle["scaler"].transform(X[ok]), -30, 30)
        raw[ok] = -bundle["model"].score_samples(Z)
    risk = to_risk(raw, bundle["anchors"])
    score = sustained(risk, N_CONSEC)
    if not np.isfinite(score):
        out["status"] = "insufficient_data"
        out["warnings"].append("최근 값이 비어 있어 특징값을 만들지 못했어요.")
        return out
    out["risk_score"] = round(score, 1)
    out["risk_level"] = level_of(score)
    out["anomaly_raw"] = float(raw[-1])
    zl = np.clip(bundle["scaler"].transform(X[-1:]), -30, 30)[0]
    pos = np.clip(zl, 0, None)
    tot = float(pos.sum()) or 1.0
    order = np.argsort(-pos)
    items = []
    for i in order[:3]:
        if pos[i] < 3.0:                                  # 평소 범위 안이면 사유로 올리지 않는다
            continue
        f = FEATS[i]
        items.append(dict(항목=INFO[f][0], 센서=sensor_id, 현재=round(float(X[-1, i]), 3), 평소=round(float(bundle["normal_median"][i]), 3),
                          설명=f"{DESC[f]} (평소 {bundle['normal_median'][i]:.2f} → 지금 {X[-1, i]:.2f}, 단위는 이 센서의 평소 변동폭)",
                          영향도=round(100 * pos[i] / tot)))
    out["reasons"] = items
    if items and score >= 40:
        out["anomaly_type"] = INFO[FEATS[order[0]]][1]
    return out


# ------------------------------------------------------------ 학습
def train(data_dir, out_path, seed=0, budget=7):
    import bench_common as bc
    from sklearn.preprocessing import RobustScaler
    parts = {k: pd.read_csv(f"{data_dir}/wl_{k}.csv", parse_dates=["observed_at"]) for k in ["train", "valid", "test"]}
    per = {k: (p.observed_at.min(), p.observed_at.max()) for k, p in parts.items()}
    df = pd.concat(parts.values(), ignore_index=True)
    lim = (float(df.level_m.min() - 10), float(df.level_m.max() + 10))
    G, T, X = [], [], []
    for sid, g in df.sort_values(["sensor_id", "observed_at"]).groupby("sensor_id"):
        gc, _ = clean(g)
        x = gc.set_index("observed_at").level_m.asfreq(STEP)
        F = features(x)
        G.append(np.full(len(x), sid)); T.append(x.index.to_numpy()); X.append(F[FEATS].to_numpy(dtype=np.float64))
    X, G, T = np.vstack(X), np.concatenate(G), np.concatenate(T)
    split = np.where(T <= np.datetime64(per["train"][1]), "train", np.where(T <= np.datetime64(per["valid"][1]), "valid", "test"))
    lay = bc.Layout(G, T, split)
    Xtr = X[split == "train"]; Xtr = Xtr[np.isfinite(Xtr).all(axis=1)]
    sc = RobustScaler().fit(Xtr)
    Ztr = np.clip(sc.transform(Xtr), -30, 30).astype(np.float32)
    rng = np.random.default_rng(seed)
    if len(Ztr) > 60000:
        Ztr = Ztr[rng.choice(len(Ztr), 60000, replace=False)]
    ifm = bc.IForest(seed).fit(Ztr).m
    ok = np.isfinite(X).all(axis=1) & (split != "train")
    raw = np.full(len(X), np.nan, dtype=np.float32)
    ii = np.where(ok)[0]
    raw[ii] = -ifm.score_samples(np.clip(sc.transform(X[ii]), -30, 30))
    thr, k = bc.pick_threshold(raw, lay, N_CONSEC, budget)
    vmask = split == "valid"
    anchors = make_anchors(raw[vmask], thr)
    vx = X[vmask]; vx = vx[np.isfinite(vx).all(axis=1)]
    bundle = dict(version="wl-w4-if-1", feats=FEATS, scaler=sc, model=ifm, anchors=anchors, n_consec=N_CONSEC, period=STEP, lim=lim,
                  normal_median=[float(v) for v in np.median(vx, axis=0)],
                  note="합성 데이터로 학습. 시연·개발용. 실제 데이터로 재학습 전까지 성능 수치는 참고치.")
    if out_path:
        joblib.dump(bundle, out_path)
    risk = np.full(len(X), np.nan)
    risk[ok] = to_risk(raw[ok], anchors)
    sm = np.full(len(X), np.nan)
    for _, lo, hi in lay.blocks["test"] + lay.blocks["valid"]:
        w = np.lib.stride_tricks.sliding_window_view(np.concatenate([[np.nan] * (N_CONSEC - 1), risk[lo:hi]]), N_CONSEC)
        sm[lo:hi] = np.where(np.isfinite(w).all(axis=1), w.min(axis=1), np.nan)
    ev = pd.read_csv(f"{data_dir}/wl_events.csv", parse_dates=["start", "end"])
    ev = ev[(ev.split == "test") & (ev.type != "dropout")].rename(columns={"sensor_id": "group"})
    cfg = dict(n_consec=N_CONSEC, fa_pad=((1, "h"), (3, "h")), detect_post=(1, "h"), lead_mode="delay",
               test_group_months=14, valid_budget_count=budget, ap_skip=0.0, fa_budget_test=1.0)
    met = bc.evaluate(raw, lay, ev, cfg, thr)
    return bundle, dict(raw=raw, risk=sm, lay=lay, events=ev, cfg=cfg, metrics=met, thr=thr, valid_alerts=k, X=X, G=G, T=T, split=split)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["train"])
    ap.add_argument("--data", required=True)
    ap.add_argument("--out", default="models/wl_model.joblib")
    ap.add_argument("--budget", type=int, default=7)
    a = ap.parse_args()
    b, info = train(a.data, a.out, budget=a.budget)
    m = info["metrics"]
    print(json.dumps({k: m[k] for k in ["n_events", "recall", "fa_per_gm", "recall_oracle", "ap", "auc", "median_delay", "per_type"]}, ensure_ascii=False, indent=1))
    print("anchors", {k: (round(v, 4) if isinstance(v, float) else v) for k, v in b["anchors"].items() if k != "y"})
