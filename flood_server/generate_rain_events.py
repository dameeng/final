from pathlib import Path

import numpy as np
import pandas as pd

BASE = Path(__file__).resolve().parent
SOURCE = BASE / "data" / "busan_weather_summer_features.csv"
OUTPUT = BASE / "data" / "rain_events.csv"

rng = np.random.default_rng(42)
df = pd.read_csv(SOURCE, encoding="utf-8-sig")
df["timestamp"] = pd.to_datetime(df["timestamp"])
df = df.sort_values("timestamp").reset_index(drop=True)

# 값이 확인되고, 시간이 연속된 구간만 원본 패턴으로 사용
valid = df["rain_now"].notna()
new_block = (
    valid.ne(valid.shift())
    | df["timestamp"].diff().ne(pd.Timedelta(hours=1))
)
df["block"] = new_block.cumsum()

templates = []
for _, block in df[valid].groupby("block"):
    values = block["rain_now"].to_numpy(dtype=float)

    if len(values) >= 6 and values.sum() > 0:
        templates.append({
            "values": values,
            "start": block["timestamp"].iloc[0],
        })

if not templates:
    raise ValueError("사용할 강우 구간이 없습니다. 원본 파일을 확인해주세요.")

weather_types = [
    "맑음", "일반 비", "장마", "소나기", "집중호우", "태풍"
]
all_events = []

for event_no in range(600):
    weather_type = weather_types[event_no % len(weather_types)]
    template = templates[int(rng.integers(len(templates)))]
    original = template["values"]
    wet_indices = np.flatnonzero(original > 0)
    original = original[wet_indices[0]:wet_indices[-1] + 1]

    # 72시간 선행 구간 + 분석 48시간 + 미래 6시간
    rain = np.zeros(126, dtype=float)

    if weather_type != "맑음":
        duration_ranges = {
            "일반 비": (12, 30),
            "장마": (30, 48),
            "소나기": (2, 7),
            "집중호우": (6, 18),
            "태풍": (24, 48),
        }
        peak_ranges = {
            "일반 비": (2, 12),
            "장마": (10, 35),
            "소나기": (15, 60),
            "집중호우": (35, 90),
            "태풍": (20, 70),
        }

        low, high = duration_ranges[weather_type]
        duration = int(rng.integers(low, high + 1))

        # 원본 패턴의 시간 길이와 강도를 변형
        pattern = np.interp(
            np.linspace(0, len(original) - 1, duration),
            np.arange(len(original)),
            original,
        )
        peak = rng.uniform(*peak_ranges[weather_type])
        # 짧은 강우를 보간하다 패턴이 전부 0이 되는 경우 방지
        if pattern.max() <= 0:
            pattern = np.ones(duration)

        shape = pattern / pattern.max()

        # 강한 비가 지속되는 실험 시나리오 추가
        # 실제 관측값이 아니라 합성 가정임
        if weather_type in ("집중호우", "태풍"):
            if event_no % 4 < 2:
               shape = np.maximum(shape, 0.45)

        pattern = shape * peak
        pattern *= rng.uniform(0.8, 1.2, duration)

        start = int(rng.integers(72, min(84, len(rain) - duration) + 1))
        rain[start:start + duration] = pattern

        # 선행 강우도 합성값이며 실제 관측값이 아님
        if rng.random() < 0.65:
            previous_start = int(rng.integers(0, 48))
            previous_duration = int(rng.integers(6, 25))
            rain[
                previous_start:previous_start + previous_duration
            ] = rng.gamma(1.5, 2.0, previous_duration)

    series = pd.Series(rain)
    event = pd.DataFrame({
        "event_id": f"EV{event_no + 1:04d}",
        # 같은 달 원본에서 파생된 이벤트는 나중에 같은 분할에 배치
        "source_group_id": template["start"].strftime("%Y-%m"),
        "source_start": template["start"],
        "weather_type": weather_type,
        "is_synthetic": 1,
        "event_hour": np.arange(48),
    })

    # 합성 이벤트 내부 시각: 실제 관측 날짜로 오해하지 않도록 시간 번호 사용
    features = {
        "rain_now": series,
        "rain_1h": series,
        "rain_3h": series.rolling(3).sum(),
        "rain_6h": series.rolling(6).sum(),
        "rain_24h": series.rolling(24).sum(),
        "rain_max_1h_24h": series.rolling(24).max(),
        "rain_prev3d": series.shift(1).rolling(72).sum(),
        "rain_trend": series.diff(),
    }

    for column, values in features.items():
        event[column] = values.iloc[72:120].to_numpy()

    forecast_type = rng.choice(["정확", "과소", "과대"])
    factor_ranges = {
        "정확": (0.9, 1.1),
        "과소": (0.4, 0.8),
        "과대": (1.2, 1.8),
    }
    factor = rng.uniform(*factor_ranges[forecast_type])
    event["forecast_error_type"] = forecast_type

    # 미래 시간별 강수에 오차를 넣은 후 누적
    # 따라서 1시간 예측 <= 3시간 예측 <= 6시간 예측
    forecast_hourly = np.maximum(
        rain * factor + rng.normal(0, 0.3, len(rain)), 0
    )

    for horizon in (1, 3, 6):
        event[f"forecast_rain_{horizon}h"] = [
            forecast_hourly[t + 1:t + horizon + 1].sum()
            for t in range(72, 120)
        ]

    all_events.append(event)

result = pd.concat(all_events, ignore_index=True)

numeric_features = list(features) + [
    "forecast_rain_1h", "forecast_rain_3h", "forecast_rain_6h"
]
if result[numeric_features].isna().any().any():
    raise ValueError("생성된 강수 입력값에 빈칸이 있습니다.")

result.round(3).to_csv(OUTPUT, index=False, encoding="utf-8-sig")

print(f"저장 완료: {OUTPUT}")
print(f"사용한 실제 강우 구간: {len(templates)}개")
print(f"합성 이벤트: {result['event_id'].nunique()}개")
print(f"전체 행: {len(result):,}개")
print("합성 데이터이며 실제 침수 관측 자료가 아닙니다.")