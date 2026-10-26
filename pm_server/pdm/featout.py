# -*- coding: utf-8 -*-
"""features[] 출력: 네 종류가 같은 모양으로 '이번 점수에 쓰인 특징값 전체'를 돌려줘요 (Spring detail.features 로 저장, 화면의 특징 카드).

한 칸의 모양
  key          영문 식별자 (예: vib_level)
  label        화면에 보일 한글 이름
  kind         "집계값"(mean·max·std…) / "변화량"(slope)
  value        지금 값
  unit         단위 (비어 있을 수 있어요)
  normal       {median, low, high}  평소 값과 정상 범위. high 를 넘으면(변화량은 low 아래도) 사유로 올라오는 지점이에요
  contribution 영향도(%). 전체 합이 100. 점수를 끌어올린 정도(나쁜 쪽으로 벗어난 만큼)의 비율이고,
               모두 평소 범위 안이면 벗어난 크기(|z|)의 비율로 채워요
  direction    up(평소보다 큼) / down(평소보다 작음)

팀원 코드(pm_final)는 고치지 않고, 여기서 같은 입력으로 특징값을 한 번 더 계산해요 (창이 작아서 부담이 없어요).
정상 범위는 모델 스케일러(중앙값 ± 3 × IQR)를 기준으로 해요: 사유 판정(z >= 3)과 같은 지점이라 화면의 '정상 범위'와 사유가 어긋나지 않아요.
전광판은 팀원 사유 기준(|z| >= 2)에 맞춰 평소 중앙값 ± 2 × 흔들림이에요.
"""
import numpy as np
import pandas as pd

from . import diag
from .features import SPECS, sliding
from .teammate import pdm_vms, pdm_wl

BAND_Z = diag.REASON_Z                 # 3.0 : 스케일러 단위 (CCTV·펌프·수위계)
VMS_BAND_Z = 2.0                       # 전광판 팀원 사유 기준

KIND_OF_STAT = {"slope": "변화량"}
WL_KIND = {"res_max3": "집계값", "res_max12": "집계값", "res_sd12": "집계값", "slope_dev": "변화량", "slope24": "변화량"}
WL_UNIT = "배"                         # 수위계 특징은 '그 센서의 평소 변동폭' 단위
VMS_UNIT = {"temp_gap": "℃", "ripple_v": "V", "response_time_ms": "ms", "error_count": "건", "bad_pixel_pct": "%"}


def _num(v, nd=3):
    if v is None:
        return None
    v = float(v)
    return round(v, nd) if np.isfinite(v) else None


def split_100(weights):
    """비율 -> 합이 정확히 100 인 정수 목록 (가장 큰 나머지부터 올림). 전부 0 이면 전부 0"""
    w = np.asarray(weights, dtype=float)
    w = np.where(np.isfinite(w), np.clip(w, 0, None), 0.0)
    tot = w.sum()
    if tot <= 0:
        return [0] * len(w)
    raw = w / tot * 100
    base = np.floor(raw).astype(int)
    rest = 100 - int(base.sum())
    for i in np.argsort(-(raw - base))[:rest]:
        base[i] += 1
    return [int(v) for v in base]


def _rows(items):
    """items: dict(key,label,kind,value,unit,median,low,high,bad,absz) 목록 -> features[]"""
    contrib = split_100([it["bad"] for it in items])
    if sum(contrib) == 0:                                    # 모두 평소 범위 안: 벗어난 크기 비율로
        contrib = split_100([it["absz"] for it in items])
    out = []
    for it, c in zip(items, contrib):
        out.append(dict(key=it["key"], label=it["label"], kind=it["kind"], value=_num(it["value"]), unit=it["unit"],
                        normal=dict(median=_num(it["median"]), low=_num(it["low"]), high=_num(it["high"])),
                        contribution=c, direction="up" if it["value"] >= it["median"] else "down"))
    return out


def _band(center, scale, can_be_negative, z=BAND_Z):
    lo, hi = center - z * scale, center + z * scale
    if not can_be_negative:
        lo = max(lo, 0.0)
    return lo, hi


# ------------------------------------------------------------------ CCTV · 펌프
def own_features(etype, cfg, bundle, df):
    d, _ = diag.clean(etype, df)
    w = d.dropna().tail(diag.need_rows(etype, bundle["n_consec"]))
    X, _ = sliding(etype, w, baseline=bundle["baseline"])
    x = X[-1]
    sc = bundle["scaler"]
    zl = np.clip(sc.transform(x.reshape(1, -1)), -30, 30)[0]
    items = []
    for i, (key, label, source, stat, direction) in enumerate(SPECS[etype]["features"]):
        bad = -zl[i] if bundle["dirs"][i] == "down" else zl[i] if bundle["dirs"][i] == "up" else abs(zl[i])
        kind = KIND_OF_STAT.get(stat, "집계값")
        lo, hi = _band(float(sc.center_[i]), float(sc.scale_[i]), kind == "변화량" or direction != "up")
        items.append(dict(key=key, label=label, kind=kind, value=x[i], unit=cfg.UNITS.get(key, ""),
                          median=float(bundle["normal_median"][i]), low=lo, high=hi, bad=max(float(bad), 0.0), absz=abs(float(zl[i]))))
    return _rows(items)


# ------------------------------------------------------------------ 수위계 (팀원 pdm_wl)
def wl_features(bundle, df):
    d, _ = pdm_wl.clean(df, bundle["lim"])
    x = d.set_index("observed_at").level_m.asfreq(pdm_wl.STEP)
    X = pdm_wl.features(x)[pdm_wl.FEATS].to_numpy(dtype=float)
    last = X[-1]
    sc = bundle["scaler"]
    zl = np.clip(sc.transform(last.reshape(1, -1)), -30, 30)[0]
    items = []
    for i, f in enumerate(pdm_wl.FEATS):
        lo, hi = _band(float(sc.center_[i]), float(sc.scale_[i]), False)
        items.append(dict(key=f, label=pdm_wl.INFO[f][0], kind=WL_KIND[f], value=last[i], unit=WL_UNIT,
                          median=float(bundle["normal_median"][i]), low=lo, high=hi, bad=max(float(zl[i]), 0.0), absz=abs(float(zl[i]))))
    return _rows(items)


# ------------------------------------------------------------------ 전광판 (팀원 pdm_vms)
def vms_baseline(bundle, equipment_id, df, baseline):
    """팀원 diagnose 가 고르는 평소 값과 같은 순서: 넘겨준 값 -> 이력에서 직접 -> 번들에 저장된 값"""
    if baseline is not None:
        return baseline
    d, _ = pdm_vms.clean(df)
    if len(d) >= pdm_vms.LAG_H + pdm_vms.MIN_BASE_H + 24:
        b = pdm_vms.baseline_at(pdm_vms.r24_of(d), pd.Timestamp(d.collected_at.max()).floor("h"))
        if b is not None:
            return b
    return bundle["baseline"].get(equipment_id)


def vms_features(bundle, equipment_id, df, baseline):
    base = vms_baseline(bundle, equipment_id, df, baseline)
    d, _ = pdm_vms.clean(df)
    r24 = pdm_vms.r24_of(d)
    med = pd.Series(base["med"], index=pdm_vms.VARS)
    mad = pd.Series(base["mad"], index=pdm_vms.VARS)
    z = pdm_vms.z_stored(r24, med, mad).iloc[-1]
    cur = r24.iloc[-1]
    items = []
    for v in pdm_vms.VARS:
        den = float(mad[v]) + 1e-6 + 0.02 * abs(float(med[v]))        # z_stored 의 분모와 같음
        lo, hi = _band(float(med[v]), den, v == "temp_gap", VMS_BAND_Z)
        zv = float(z[v])
        items.append(dict(key=v, label=pdm_vms.INFO[v][0], kind="집계값", value=cur[v], unit=VMS_UNIT[v],
                          median=float(med[v]), low=lo, high=hi, bad=abs(zv), absz=abs(zv)))
    return _rows(items)
