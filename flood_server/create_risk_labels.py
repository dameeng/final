from pathlib import Path

import numpy as np
import pandas as pd

BASE = Path(__file__).resolve().parent
DATA = BASE / "data"
SOURCE = DATA / "flood_training_inputs.csv"
OUTPUT = DATA / "flood_training_dataset.csv"

rng = np.random.default_rng(42)

# 같은 원본에서 파생된 이벤트가 서로 다른 분할에 섞이지 않게 함
groups = pd.read_csv(
    SOURCE,
    usecols=["source_group_id"],
    encoding="utf-8-sig",
)["source_group_id"].dropna().unique()

# 이번 실험의 고정 분할
# 같은 달에서 파생된 이벤트는 모두 같은 분할에 유지
split_map = {
    group: (
        "test" if group == "2025-04"
        else "validation" if group == "2025-05"
        else "train"
    )
    for group in groups
}

if not {"2025-04", "2025-05"}.issubset(set(groups)):
    raise ValueError("분할에 필요한 4월·5월 원본 그룹이 없습니다.")

pd.DataFrame(
    list(split_map.items()),
    columns=["source_group_id", "split"],
).to_csv(
    DATA / "dataset_split_groups.csv",
    index=False,
    encoding="utf-8-sig",
)


def scaled(values, reference):
    # 값이 커질수록 증가하되 1에 서서히 가까워짐
    return 1 - np.exp(-values.clip(lower=0) / reference)


counts = {"train": 0, "validation": 0, "test": 0}
risk_counts = {"안전": 0, "주의": 0, "위험": 0}
total = 0

with OUTPUT.open("w", encoding="utf-8-sig", newline="") as stream:
    for number, chunk in enumerate(
        pd.read_csv(SOURCE, encoding="utf-8-sig", chunksize=50000)
    ):
        # 실험용 가중치: 실제 침수 자료로 보정된 값이 아님
        rain_burden = (
            0.20 * scaled(chunk["rain_now"], 30)
            + 0.12 * scaled(chunk["rain_3h"], 60)
            + 0.10 * scaled(chunk["rain_6h"], 100)
            + 0.12 * scaled(chunk["rain_24h"], 180)
            + 0.08 * scaled(chunk["rain_max_1h_24h"], 40)
            + 0.08 * scaled(chunk["rain_prev3d"], 250)
            + 0.05 * scaled(chunk["rain_trend"], 15)
            + 0.08 * scaled(chunk["forecast_rain_1h"], 30)
            + 0.09 * scaled(chunk["forecast_rain_3h"], 60)
            + 0.08 * scaled(chunk["forecast_rain_6h"], 100)
        )

        vulnerability = (
            0.25 * scaled(chunk["underpass_depth"], 5)
            + 0.15 * scaled(chunk["underpass_length"], 300)
            + 0.30 * chunk["pump_risk_score"].clip(0, 100) / 100
            + 0.20 * np.exp(-chunk["dist_river_m"] / 500)
            + 0.10 * np.exp(-chunk["dist_sea_m"] / 1500)
        )

        # 강우 부담과 취약도를 결합
        base_score = (
            100 * rain_burden * (0.55 + 0.45 * vulnerability)
        )
        noise = rng.normal(0, 2, len(chunk))

        chunk["risk_score_base"] = base_score.round(3)
        chunk["risk_score"] = np.clip(
            base_score + noise, 0, 100
        ).round(2)
        chunk["label_is_synthetic"] = 1
        chunk["label_formula_version"] = "experimental_v1"

        # 아래 구간 역시 실험용 기준
        chunk["risk_level"] = pd.cut(
            chunk["risk_score"],
            bins=[-1, 30, 60, 100],
            labels=["안전", "주의", "위험"],
        )
        chunk["split"] = chunk["source_group_id"].map(split_map)

        if chunk["split"].isna().any():
            raise ValueError("분할이 지정되지 않은 원본 그룹이 있습니다.")

        for key, value in chunk["split"].value_counts().items():
            counts[key] += int(value)

        for key, value in chunk["risk_level"].value_counts().items():
            risk_counts[str(key)] += int(value)

        chunk.to_csv(stream, index=False, header=(number == 0))
        total += len(chunk)

print(f"저장 완료: {OUTPUT}")
print(f"전체 행: {total:,}개")

for key, value in counts.items():
    print(f"{key}: {value:,}개")

for key, value in risk_counts.items():
    print(f"{key}: {value:,}개")

print("같은 원본 그룹은 동일한 데이터 분할에 배치했습니다.")
print("risk_score는 합성 정답이며 실제 침수 확률이 아닙니다.")