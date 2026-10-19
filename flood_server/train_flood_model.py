from pathlib import Path
import json

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error
from threadpoolctl import threadpool_limits

BASE = Path(__file__).resolve().parent
SOURCE = BASE / "data" / "flood_training_dataset.csv"
OUTPUT = BASE / "models" / "experimental_v1"
OUTPUT.mkdir(parents=True, exist_ok=True)

FEATURES = [
    "rain_now", "rain_1h", "rain_3h", "rain_6h",
    "rain_24h", "rain_max_1h_24h", "rain_prev3d",
    "rain_trend",
    "forecast_rain_1h", "forecast_rain_3h", "forecast_rain_6h",
    "underpass_depth", "underpass_length", "pump_risk_score",
    "dist_river_m", "dist_sea_m",
]

# 1: 증가 방향, -1: 감소 방향
DIRECTIONS = [1] * 14 + [-1, -1]

print("데이터 읽는 중...", flush=True)
df = pd.read_csv(
    SOURCE,
    usecols=FEATURES + [
        "risk_score", "split", "source_group_id", "event_id"
    ],
    encoding="utf-8-sig",
)

if df[FEATURES + ["risk_score"]].isna().any().any():
    raise ValueError("학습 입력값 또는 정답에 빈칸이 있습니다.")

if not np.isfinite(df[FEATURES + ["risk_score"]].to_numpy()).all():
    raise ValueError("무한대 등 잘못된 숫자가 있습니다.")

if df.groupby("source_group_id")["split"].nunique().max() > 1:
    raise ValueError("같은 원본 그룹이 서로 다른 분할에 있습니다.")

if df.groupby("event_id")["split"].nunique().max() > 1:
    raise ValueError("같은 이벤트가 서로 다른 분할에 있습니다.")

parts = {}
for split in ("train", "validation", "test"):
    part = df.loc[df["split"] == split]
    if part.empty:
        raise ValueError(f"{split} 데이터가 없습니다.")
    parts[split] = (
        part[FEATURES].astype("float32"),
        part["risk_score"].astype("float32"),
    )
    print(f"{split}: {len(part):,}행", flush=True)

X_train, y_train = parts["train"]
X_valid, y_valid = parts["validation"]

model = HistGradientBoostingRegressor(
    learning_rate=0.08,
    max_iter=250,
    max_leaf_nodes=31,
    l2_regularization=1.0,
    monotonic_cst=DIRECTIONS,
    early_stopping=True,
    n_iter_no_change=15,
    random_state=42,
    verbose=1,
)

print("학습 시작...", flush=True)

# 별도로 나눈 검증 데이터로 조기 종료 판단
with threadpool_limits(limits=4):
    model.fit(
        X_train,
        y_train,
        X_val=X_valid,
        y_val=y_valid,
    )

    metrics = {}
    baseline = float(y_train.mean())

    for split in ("validation", "test"):
        X, y = parts[split]
        prediction = np.clip(model.predict(X), 0, 100)

        metrics[split] = {
            "mae": float(mean_absolute_error(y, prediction)),
            "rmse": float(np.sqrt(
                mean_squared_error(y, prediction)
            )),
            "mean_baseline_mae": float(
                np.abs(y.to_numpy() - baseline).mean()
            ),
        }

        print(f"\n[{split}]")
        for key, value in metrics[split].items():
            print(f"{key}: {value:.3f}")

        # 안전·주의·위험 구간별 오차도 따로 확인
        for name, mask in [
            ("safe", y <= 30),
            ("caution", (y > 30) & (y <= 60)),
            ("danger", y > 60),
        ]:
            selected = mask.to_numpy()
            if selected.any():
                mae = mean_absolute_error(
                    y.to_numpy()[selected],
                    prediction[selected],
                )
                print(f"{name}: {selected.sum():,}행 / MAE {mae:.3f}")
            else:
                print(f"{name}: 0행")

    # 여러 입력 사례에서 한 컬럼만 키워 방향 검사
    X_test, _ = parts["test"]
    sample = X_test.sample(
        n=min(1000, len(X_test)), random_state=42
    ).copy()

    steps = {
        "underpass_depth": 1.0,
        "pump_risk_score": 10.0,
        "dist_river_m": 100.0,
        "dist_sea_m": 100.0,
        "forecast_rain_1h": 10.0,
        "forecast_rain_3h": 10.0,
        "forecast_rain_6h": 10.0,
    }

    original_prediction = model.predict(sample)
    direction_results = {}

    print("\n[방향성 검사]")
    for column, step in steps.items():
        changed = sample.copy()
        changed[column] += step

        if column == "pump_risk_score":
            changed[column] = changed[column].clip(upper=100)

        delta = model.predict(changed) - original_prediction

        if column.startswith("dist_"):
            violations = int((delta > 1e-7).sum())
        else:
            violations = int((delta < -1e-7).sum())

        direction_results[column] = {
            "violations": violations,
            "mean_change": float(delta.mean()),
            "unchanged": int((np.abs(delta) <= 1e-7).sum()),
        }
        print(
            f"{column}: 위반 {violations}건 / "
            f"평균 변화 {delta.mean():.4f}"
        )

if any(v["violations"] for v in direction_results.values()):
    raise ValueError("방향성 위반이 있어 모델 저장을 중단합니다.")

joblib.dump(model, OUTPUT / "model.joblib")

metadata = {
    "features": FEATURES,
    "monotonic_constraints": DIRECTIONS,
    "metrics": metrics,
    "direction_checks": direction_results,
    "iterations": int(model.n_iter_),
    "experimental_only": True,
    "limitations": [
        "합성 공식으로 만든 점수를 학습함",
        "실제 침수 확률을 검증한 모델이 아님",
        "깊이와 펌프 점수에 임시 값이 포함됨",
        "결과를 확인한 뒤 정한 개발용 데이터 분할임",
    ],
}

with (OUTPUT / "metadata.json").open("w", encoding="utf-8") as f:
    json.dump(metadata, f, ensure_ascii=False, indent=2)

print(f"\n모델 저장 완료: {OUTPUT}")
print("기존 서버 모델은 교체하지 않았습니다.")