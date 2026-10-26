from pathlib import Path
import pandas as pd

BASE = Path(__file__).resolve().parent
SOURCE = BASE / "data" / "busan_weather_2025.csv"
OUTPUT = BASE / "data" / "busan_weather_features.csv"

# 기상청 CSV 인코딩 자동 확인
for encoding in ("utf-8-sig", "cp949"):
    try:
        df = pd.read_csv(SOURCE, encoding=encoding)
        break
    except UnicodeDecodeError:
        continue
else:
    raise ValueError("CSV 인코딩을 확인해주세요.")

df["timestamp"] = pd.to_datetime(df["일시"], errors="raise")
df = df.sort_values("timestamp").set_index("timestamp")

if df.index.duplicated().any():
    raise ValueError("중복된 시각이 있습니다.")

# 빠진 시간이 있으면 행을 만들되, 값은 빈칸으로 유지
hours = pd.date_range(df.index.min(), df.index.max(), freq="h")
df = df.reindex(hours)
df.index.name = "timestamp"

rain = pd.to_numeric(df["강수량(mm)"], errors="raise")

if (rain.dropna() < 0).any():
    raise ValueError("음수 강수량이 있습니다.")

result = pd.DataFrame(index=df.index)
result["rain_raw_mm"] = rain
result["rain_missing"] = rain.isna().astype(int)

# 현재 시각에 기록된 직전 1시간 관측 강수량
result["rain_now"] = rain
result["rain_1h"] = rain

for hours in (3, 6, 24):
    result[f"rain_{hours}h"] = rain.rolling(
        hours, min_periods=hours
    ).sum()

result["rain_max_1h_24h"] = rain.rolling(
    24, min_periods=24
).max()

# 현재 시각 직전 72시간: 현재 시간 관측값 제외
result["rain_prev3d"] = rain.shift(1).rolling(
    72, min_periods=72
).sum()

result["rain_trend"] = rain.diff()

result.round(3).to_csv(OUTPUT, encoding="utf-8-sig")

print(f"저장 완료: {OUTPUT}")
print(f"전체 시간: {len(result):,}개")
print(f"강수량 빈칸: {rain.isna().sum():,}개")
print("빈칸의 의미 확인 전까지 학습에는 사용하지 않습니다.")

DAILY = BASE / "data" / "busan_weather_daily_2025.csv"

for encoding in ("utf-8-sig", "cp949"):
    try:
        daily = pd.read_csv(DAILY, encoding=encoding)
        break
    except UnicodeDecodeError:
        continue

daily["date"] = pd.to_datetime(daily["일시"]).dt.normalize()
daily = daily.set_index("date")

# 00:00에 끝나는 직전 시간의 강수량은 전날에 포함
rain_dates = (rain.index - pd.Timedelta(seconds=1)).normalize()
hourly_sum = rain.groupby(rain_dates).sum(min_count=1)

check = daily[["일강수량(mm)"]].copy()
check["hourly_sum_mm"] = hourly_sum.reindex(check.index)
check["difference_mm"] = (
    check["일강수량(mm)"] - check["hourly_sum_mm"]
).round(3)
check["matched"] = check["difference_mm"].abs() <= 0.1

check.to_csv(
    BASE / "data" / "weather_daily_check.csv",
    encoding="utf-8-sig",
)

print(f"일별 합계 일치: {check['matched'].sum()} / {len(check)}일")

# 1시간 단위로 제공되는 4~10월만 우선 사용
summer = rain.loc["2025-04-01":"2025-10-31"].copy()

# 자정 관측값은 전날 강수량에 포함
dates = (summer.index - pd.Timedelta(seconds=1)).normalize()

# 일강수량과 시간별 합계가 일치한 날짜만 사용
matched_dates = check.index[check["matched"]]
verified_day = dates.isin(matched_dates)

# 빈칸을 실제 관측 0과 구분하여 기록
inferred_zero = summer.isna() & verified_day
clean_rain = summer.copy()
clean_rain.loc[inferred_zero] = 0

features = pd.DataFrame(index=summer.index)
features.index.name = "timestamp"
features["rain_raw_mm"] = summer
features["rain_zero_inferred"] = inferred_zero.astype(int)
features["rain_unresolved"] = clean_rain.isna().astype(int)

# 원자료가 있는 경우도 일별 검증이 안 된 날은 제외
clean_rain = clean_rain.where(verified_day)

features["rain_now"] = clean_rain
features["rain_1h"] = clean_rain

for window in (3, 6, 24):
    features[f"rain_{window}h"] = clean_rain.rolling(
        window, min_periods=window
    ).sum()

features["rain_max_1h_24h"] = clean_rain.rolling(
    24, min_periods=24
).max()

features["rain_prev3d"] = clean_rain.shift(1).rolling(
    72, min_periods=72
).sum()

features["rain_trend"] = clean_rain.diff()

required = [
    "rain_now", "rain_1h", "rain_3h", "rain_6h",
    "rain_24h", "rain_max_1h_24h", "rain_prev3d", "rain_trend",
]
features["rain_features_complete"] = (
    features[required].notna().all(axis=1).astype(int)
)

destination = BASE / "data" / "busan_weather_summer_features.csv"
features.round(3).to_csv(destination, encoding="utf-8-sig")

print(f"여름철 가공 파일: {destination}")
print(f"0으로 추정한 빈칸: {inferred_zero.sum():,}개")
print(f"강수 입력값 완성 행: {features['rain_features_complete'].sum():,}개")