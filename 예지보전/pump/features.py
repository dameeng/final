"""롤링 특징 생성 + 라벨(고장까지 남은 시간, HORIZON_H 내 고장, RUL) 생성"""
import numpy as np
import pandas as pd

from pump_config import BASELINE_H, HORIZON_H, RUL_CAP_H, STEPS_PER_HOUR

Z_CLIP = 20


def build_features(data, sensors):
    """
    센서 절대값은 정비/운전 구간마다 기준이 달라져(regime drift) 모델이 '어느 구간인지'를 외우게 됨.
    → 각 센서의 최근 BASELINE_H 정상 구간 중앙값·표준편차 대비 편차(z)만 사용.
    특징 이름은 '<센서>__<종류>' 형식 (④에서 센서 단위로 묶을 때 사용).
    """
    x = data[sensors]
    if "status" in data:
        x = x.where(data["status"] == 0)  # 고장/복구 구간 값은 기준선에서 제외
    h = STEPS_PER_HOUR
    win = BASELINE_H * h
    base = x.rolling(win, min_periods=h).median()
    scale = x.rolling(win, min_periods=h).std() + 1e-6

    def z(df):
        return (df / scale).clip(-Z_CLIP, Z_CLIP)

    return pd.concat(
        [
            z(x.rolling(h, min_periods=1).mean() - base).add_suffix("__dev1h"),
            z(x.rolling(6 * h, min_periods=1).mean() - base).add_suffix("__dev6h"),
            z(x.rolling(6 * h, min_periods=2).std()).add_suffix("__vol6h"),
            z(x.diff(h)).add_suffix("__diff1h"),
        ],
        axis=1,
    )


def anomaly_input(feats):
    """① 이상탐지 입력: 센서별 1시간 평균의 기준선 대비 편차."""
    return feats.filter(like="__dev1h").fillna(0)


def sensor_of(feature):
    return feature.split("__")[0]


def build_labels(data, failures):
    """
    cycle   : k번째 고장으로 끝나는 운전 구간 번호 (마지막 고장 이후는 len(failures))
    ttf_h   : 다음 고장까지 남은 시간(h), 이후 고장 없으면 NaN
    y_cls   : HORIZON_H 이내 고장 여부 (데이터 끝부분처럼 알 수 없으면 NaN)
    y_rul   : min(ttf_h, RUL_CAP_H) (알 수 없으면 NaN)
    normal  : 10분 구간 전체가 NORMAL 상태인지
    """
    t = data.index
    f = pd.DatetimeIndex(sorted(failures))
    cycle = f.searchsorted(t, side="left")
    has_next = cycle < len(f)

    ttf_h = np.full(len(t), np.nan)
    ttf_h[has_next] = (f[cycle[has_next]] - t[has_next]).total_seconds() / 3600
    hours_to_end = (t[-1] - t).total_seconds().to_numpy() / 3600

    y_cls = np.where(has_next, ttf_h <= HORIZON_H, np.where(hours_to_end >= HORIZON_H, 0, np.nan))
    y_rul = np.where(has_next, np.minimum(ttf_h, RUL_CAP_H), np.where(hours_to_end >= RUL_CAP_H, RUL_CAP_H, np.nan))

    return pd.DataFrame(
        {
            "cycle": cycle,
            "ttf_h": ttf_h,
            "y_cls": y_cls.astype(float),
            "y_rul": y_rul,
            "normal": (data["status"] == 0).to_numpy(),
        },
        index=t,
    )
