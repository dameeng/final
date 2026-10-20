# 저장한 펌프 모델로 건강도와 상태를 계산하는 코드
# FastAPI 서버에서 이 파일의 check_pump 함수를 불러 쓰면 돼요.

from pathlib import Path

import numpy as np
import pandas as pd
import joblib

HERE = Path(__file__).resolve().parent
model = joblib.load(HERE / "펌프_모델.pkl")
scaler = joblib.load(HERE / "펌프_스케일러.pkl")
cfg = joblib.load(HERE / "펌프_설정.pkl")


def check_pump(recent: pd.DataFrame) -> dict:
    """최근 30분(30줄) 센서 데이터를 받아서 펌프 상태를 알려줘요."""
    x = recent[cfg["sensor_cols"]].ffill().bfill().mean().to_frame().T
    score = float(-model.score_samples(scaler.transform(x))[0])

    health = (cfg["worst"] - score) / (cfg["worst"] - cfg["best"]) * 100
    health = int(np.clip(health, 0, 100))

    if health < 20:
        status = "위험"
    elif health < 50:
        status = "주의"
    else:
        status = "정상"

    return {"health": health, "status": status, "score": round(score, 3)}
