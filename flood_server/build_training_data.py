from pathlib import Path

import numpy as np
import pandas as pd

BASE = Path(__file__).resolve().parent
DATA = BASE / "data"
rng = np.random.default_rng(42)


def read_csv(path):
    for encoding in ("utf-8-sig", "cp949"):
        try:
            return pd.read_csv(path, encoding=encoding)
        except UnicodeDecodeError:
            continue
    raise ValueError(f"CSV 인코딩 확인 필요: {path}")


master = read_csv(DATA / "busan_underpass_master.csv")
weather = read_csv(DATA / "rain_events.csv")

# 이름이 없는 빈 컬럼 제거
master = master.loc[
    :, ~master.columns.str.startswith("Unnamed:")
].copy()

# 원본 행 번호로 시설 식별: 이름이 같아도 자동 병합하지 않음
master["underpass_id"] = [
    f"UP{i + 1:03d}" for i in range(len(master))
]

name_columns = [
    "시설물목록_시설물명",
    "부산시자료_시설명",
    "시설물명_통합",
]
names = master[name_columns].replace(r"^\s*$", np.nan, regex=True)
master["underpass_name"] = names.bfill(axis=1).iloc[:, 0]

for column in [
    "총길이_부산시_m", "연장_FMS_m",
    "하천거리_m", "바다거리_m", "높이_부산시_원자료_m",
]:
    master[column] = pd.to_numeric(master[column], errors="coerce")

# 부산시 총길이 우선, 없으면 FMS 연장 사용
master["underpass_length"] = master["총길이_부산시_m"].combine_first(
    master["연장_FMS_m"]
)
master["underpass_height"] = master["높이_부산시_원자료_m"]
master["dist_river_m"] = master["하천거리_m"]
master["dist_sea_m"] = master["바다거리_m"]

usable = (
    master["underpass_name"].notna()
    & master["underpass_length"].gt(0)
    & master["underpass_height"].gt(0)
    & master["dist_river_m"].ge(0)
    & master["dist_sea_m"].ge(0)
)

excluded = master.loc[~usable].copy()
excluded.to_csv(
    DATA / "underpasses_excluded.csv",
    index=False,
    encoding="utf-8-sig",
)

facilities = master.loc[usable].copy()
if facilities.empty:
    raise ValueError("높이·길이·수계 거리가 있는 시설이 없습니다.")

depth = facilities["underpass_depth_m"]
known_depth = depth.notna() & depth.gt(0)

facilities["underpass_depth"] = depth.where(known_depth)
facilities["depth_is_dummy"] = (~known_depth).astype(int)

# 실험용 가정값이며 실제 시설 깊이가 아님
dummy_count = int((~known_depth).sum())
facilities.loc[~known_depth, "underpass_depth"] = rng.uniform(
    2.0, 8.0, dummy_count
)

# 대부분 낮고 일부 높은 임시 펌프 위험도
facilities["pump_base"] = rng.beta(1.5, 6.0, len(facilities)) * 100
high_risk = rng.random(len(facilities)) < 0.1
facilities.loc[high_risk, "pump_base"] = rng.uniform(
    65, 95, int(high_risk.sum())
)

columns = [
    "underpass_id", "underpass_name",
    "underpass_length", "underpass_height",
    "dist_river_m", "dist_sea_m", "pump_base",
]
facilities = facilities[columns]

# 임시 속성은 별도 파일에만 저장: 원본 마스터는 수정하지 않음
facilities.round(3).to_csv(
    DATA / "underpass_training_attributes.csv",
    index=False,
    encoding="utf-8-sig",
)

output = DATA / "flood_training_inputs.csv"
total_rows = 0

# 메모리 사용을 줄이기 위해 이벤트별로 결합 후 저장
with output.open("w", encoding="utf-8-sig", newline="") as stream:
    for number, (_, event) in enumerate(weather.groupby("event_id")):
        attributes = facilities.copy()

        # 같은 이벤트에서는 시설별 펌프 점수 유지
        attributes["pump_risk_score"] = np.clip(
            attributes["pump_base"]
            + rng.normal(0, 5, len(attributes)),
            0, 100,
        )
        attributes["pump_is_dummy"] = 1
        attributes = attributes.drop(columns="pump_base")

        joined = event.merge(attributes, how="cross")
        joined.round(3).to_csv(
            stream,
            index=False,
            header=(number == 0),
        )
        total_rows += len(joined)

print(f"저장 완료: {output}")
print(f"포함 시설: {len(facilities)}개")
print(f"제외 시설: {len(excluded)}개")
print(f"전체 행: {total_rows:,}개")
print("높이는 부산시 원자료 값을 사용했습니다. 통과 유효높이 여부는 별도 확인이 필요합니다.")
print("펌프 점수는 실험용 임시값입니다.")
print("아직 정답 risk_score를 붙이기 전 단계입니다.")