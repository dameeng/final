"""
학습된 모델로 펌프 상태 예측.
  python predict.py --input ../pump_sensor.csv --last 144
입력: timestamp, sensor_00 ~ sensor_51 컬럼을 가진 분 단위 CSV (기준선 계산을 위해 최소 72시간 이력 권장)
"""
import argparse

import joblib
import numpy as np
import pandas as pd

from pump_config import HORIZON_H, MODEL_DIR, OUT_DIR, RUL_CAP_H
from data_prep import load_raw, resample
from features import anomaly_input, build_features
from models import classifier_sensor_contrib, top_sensors


def risk_level(prob, anomaly, thr):
    """위험: 조기경보 확률이 경보 임계값 이상 / 주의: 확률이 주의 임계값 이상이거나 이상점수가 경보 임계값 이상"""
    return np.select(
        [prob >= thr["prob"], (prob >= thr["prob_warn"]) | (anomaly >= thr["anomaly"])],
        ["위험", "주의"],
        "정상",
    )


def predict(raw, bundle):
    sensors = bundle["sensors"]
    data, _ = resample(raw, sensors)
    feats = build_features(data, sensors)[bundle["features"]]
    det, clf, reg = bundle["detector"], bundle["classifier"], bundle["regressor"]

    out = pd.DataFrame(index=data.index)
    prob_col = f"fail_prob_{HORIZON_H}h"
    out["anomaly_score"] = det.score(anomaly_input(feats))                   # ①
    out[prob_col] = clf.predict_proba(feats)[:, 1]                           # ②
    out["rul_h"] = np.clip(reg.predict(feats), 0, RUL_CAP_H)                 # ③
    out["risk_level"] = risk_level(out[prob_col], out.anomaly_score, bundle["thresholds"])
    out["cause_sensors_clf"] = top_sensors(classifier_sensor_contrib(clf, feats))      # ④ 조기경보 기여 센서
    out["cause_sensors_anomaly"] = top_sensors(det.sensor_contrib(anomaly_input(feats)))    # ④ 정상 패턴 이탈 센서
    if "status" in data:
        out["status"] = data["status"].map({0: "NORMAL", 1: "RECOVERING", 2: "BROKEN"})
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", required=True)
    ap.add_argument("--output", default=str(OUT_DIR / "predictions.csv"))
    ap.add_argument("--last", type=int, default=0, help="마지막 N개(10분 단위) 결과만 저장")
    args = ap.parse_args()

    bundle = joblib.load(MODEL_DIR / "pump_models.joblib")
    out = predict(load_raw(args.input), bundle)
    if args.last:
        out = out.tail(args.last)
    out.round(4).to_csv(args.output, encoding="utf-8-sig")
    print(out.tail(10).round(3).to_string())
    print(f"saved → {args.output}")


if __name__ == "__main__":
    main()
