# -*- coding: utf-8 -*-
"""data 폴더의 학습용 샘플 데이터 (CCTV·배수펌프).

- CCTV_CSV        : CCTV 24대 1시간 간격 (고장·정비 기록 포함) -> cctv.py 가 기간을 나눠 학습·검증
- PUMP_CSV        : 펌프 1대 1분 간격 6/21~6/29 (6/28 22시 고장) -> pump_10s() 가 10초 간격으로 가공 -> pump.py
"""
from pathlib import Path

import numpy as np
import pandas as pd

from .features import DECIMALS, PUMP_COLUMNS, metrics_of

DATA = Path(__file__).resolve().parent.parent / "data"
CCTV_CSV = DATA / "cctv_sample.csv"            # 원본: cctv예지보전/cctv_maintenance_synthetic.csv
PUMP_CSV = DATA / "pump_sample.csv"            # 원본: 펌프_예지보전/시연용_6월21-29일.csv (1분 간격)
PUMP_10S_CSV = DATA / "pump_sample_10s.csv"    # 위 파일을 10초 간격으로 가공한 것 (없으면 pump_10s() 가 만들어요)

# 구간은 샘플 데이터를 직접 보고 정했어요 (2026-10-23)
PUMP_NORMAL = ("2018-06-21 00:00", "2018-06-24 11:59")   # 평소 구간 (10초 가공 잡음 크기를 여기서 재요)
PUMP_STEP_SEC = 10                                       # 펌프 모델은 10초마다 계산해요
PUMP_NOISE = 0.3                                         # 10초 가공 잡음 = 평소 1분 변화량(표준편차) x 이 값
PUMP_SEED = 42





def pump_10s(rebuild=False):
    """1분 간격 펌프 데이터 -> 10초 간격 (모델에 쓰는 센서 6개만). data/pump_sample_10s.csv 로 저장해 두고 다시 써요.
    가공: 1분 값 사이를 10초씩 직선으로 잇고, 센서마다 평소 1분 변화량에 맞춘 작은 잡음을 더해요
          (직선만 쓰면 값이 너무 매끈해서 모델이 실제 흔들림에 예민해져요). 원본 1분 값이 있는 시각(정각 분)은 그대로.
    합성 데이터예요: 원본에 1분보다 촘촘한 측정값은 없어요."""
    if PUMP_10S_CSV.exists() and not rebuild:
        return pd.read_csv(PUMP_10S_CSV, parse_dates=["timestamp"])
    raw = pd.read_csv(PUMP_CSV)
    cols = metrics_of("PUMP")
    raw = raw.rename(columns={v: k for k, v in PUMP_COLUMNS.items()})[["timestamp"] + cols]
    raw["timestamp"] = pd.to_datetime(raw["timestamp"])
    raw[cols] = raw[cols].ffill().bfill()
    minute = raw.set_index("timestamp")[cols]
    grid = pd.date_range(minute.index[0], minute.index[-1], freq="%ds" % PUMP_STEP_SEC)
    fine = minute.reindex(minute.index.union(grid)).interpolate(method="time").reindex(grid)
    normal = minute.loc[PUMP_NORMAL[0]:PUMP_NORMAL[1]]
    sd = normal.diff().std() * PUMP_NOISE
    rng = np.random.default_rng(PUMP_SEED)
    noise = pd.DataFrame(rng.normal(0, 1, fine.shape) * sd.to_numpy(), index=fine.index, columns=cols)
    noise[fine.index.second == 0] = 0.0                 # 원본 측정 시각은 원본 값 그대로
    out = (fine + noise).clip(lower=0).round(DECIMALS)
    out.index.name = "timestamp"
    out = out.reset_index()
    out.to_csv(PUMP_10S_CSV, index=False)
    return out

