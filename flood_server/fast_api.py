# -*- coding: utf-8 -*-
"""침수 예측 서버 본체.

서버가 켜지면 모델을 불러오고, FLOOD_INTERVAL_SEC(config.py)마다 자동으로
  지하차도 목록 -> 상세/강수 조회 -> 침수모델 계산 -> Spring 전송
을 반복해요. 아래 API 는 확인/테스트용이에요 (http://localhost:8001/docs).
"""
import logging
import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI
from pydantic import BaseModel

import config
from flood_risk import FloodPredictor, LEVEL_NAMES, now_iso

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(message)s", datefmt="%H:%M:%S")
log = logging.getLogger("server")

predictor = None
_stop = threading.Event()
_thread = None


@asynccontextmanager
async def lifespan(app):
    global predictor, _thread
    predictor = FloodPredictor()           # 모델 파일이 없으면 여기서 안내 메시지와 함께 멈춰요
    log.info("침수모델 로드 완료")
    if config.FLOOD_ENABLED:
        _stop.clear()
        _thread = threading.Thread(target=predictor.loop, args=(_stop,), name="flood-loop", daemon=True)
        _thread.start()
    else:
        log.info("FLOOD_ENABLED=0 이라 자동 계산을 시작하지 않았어요 (수동: POST /flood/run)")
    yield
    _stop.set()


app = FastAPI(title="침수 예측 서버", lifespan=lifespan)


@app.get("/health")
def health():
    """서버 상태"""
    last = predictor.last_run if predictor else None
    return {
        "status": "ok",
        "modelLoaded": predictor is not None,
        "floodEnabled": config.FLOOD_ENABLED,
        "intervalSec": config.FLOOD_INTERVAL_SEC,
        "springUrl": config.SPRING_URL,
        "loopAlive": bool(_thread and _thread.is_alive()),
        "lastRunAt": last["finishedAt"] if last else None,
        "lastRunOk": (last["error"] is None and last["failed"] == 0) if last else None,
        "nextRunAt": predictor.next_run_at if predictor else None,
    }


@app.get("/flood/status")
def flood_status():
    """마지막 자동 계산 결과 (지하차도별 점수/단계/건너뜀·실패 사유)"""
    return {"intervalSec": config.FLOOD_INTERVAL_SEC, "nextRunAt": predictor.next_run_at,
            "lastRun": predictor.last_run}


@app.post("/flood/run")
def flood_run():
    """지금 바로 한 바퀴 계산하고 Spring 에 전송 (실제 현재 값만 보냄)"""
    return predictor.run_once()


class PredictRequest(BaseModel):
    rainfallMm: float = 40
    rainfall1hMm: float = 10
    rainfall3hMm: float = 60
    rainfall6hMm: float = 70
    rainfall12hMm: float = 70
    rainfall24hMm: float = 70
    heightM: float = 3.6
    lengthM: float = 304


@app.post("/flood/predict")
def flood_predict(req: PredictRequest):
    """[테스트용] 값을 직접 넣어 점수만 확인해요. Spring 에 저장/전송하지 않아요."""
    p = predictor.predict([req.model_dump()])[0]
    return {"riskScore": p["riskScore"], "riskLevel": p["riskLevel"],
            "levelName": LEVEL_NAMES.get(p["riskLevel"]), "calculatedAt": now_iso()}

# ---------- 새 모델 실험용 API ----------
from pathlib import Path
from functools import lru_cache

import joblib
import numpy as np
import pandas as pd
from fastapi import HTTPException
from pydantic import Field, ConfigDict


class ExperimentalPredictRequest(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        allow_inf_nan=False,
    )

    rain_now: float = Field(ge=0)
    rain_1h: float = Field(ge=0)
    rain_3h: float = Field(ge=0)
    rain_6h: float = Field(ge=0)
    rain_24h: float = Field(ge=0)
    rain_max_1h_24h: float = Field(ge=0)
    rain_prev3d: float = Field(ge=0)
    rain_trend: float

    forecast_rain_1h: float = Field(ge=0)
    forecast_rain_3h: float = Field(ge=0)
    forecast_rain_6h: float = Field(ge=0)

    underpass_depth: float = Field(gt=0)
    underpass_length: float = Field(gt=0)
    pump_risk_score: float = Field(ge=0, le=100)
    dist_river_m: float = Field(ge=0)
    dist_sea_m: float = Field(ge=0)


@lru_cache(maxsize=1)
def load_experimental_model():
    import json

    folder = (
        Path(__file__).resolve().parent
        / "models"
        / "experimental_v1"
    )

    with (folder / "metadata.json").open(
        encoding="utf-8"
    ) as file:
        metadata = json.load(file)

    model = joblib.load(folder / "model.joblib")
    columns = metadata["features"]

    if list(model.feature_names_in_) != columns:
        raise ValueError("모델과 입력 컬럼 순서가 다릅니다.")

    return model, columns


@app.post("/flood/experimental/predict")
def experimental_predict(req: ExperimentalPredictRequest):
    """합성 데이터로 학습한 실험 모델. Spring으로 전송하지 않음."""
    try:
        model, columns = load_experimental_model()
    except Exception:
        log.exception("실험 모델 로드 실패")
        raise HTTPException(
            status_code=503,
            detail="실험 모델 파일과 metadata.json을 확인해주세요.",
        )

    values = req.model_dump()

    if not (
        values["forecast_rain_1h"]
        <= values["forecast_rain_3h"]
        <= values["forecast_rain_6h"]
    ):
        raise HTTPException(
            status_code=422,
            detail="예측 누적 강수량은 1h <= 3h <= 6h여야 합니다.",
        )

    frame = pd.DataFrame([values], columns=columns)
    score = float(np.clip(model.predict(frame)[0], 0, 100))

    level = (
        "안전" if score <= 30
        else "주의" if score <= 60
        else "위험"
    )

    return {
        "riskScore": round(score, 2),
        "experimentalRiskLevel": level,
        "experimental": True,
        "modelVersion": "experimental_v1",
        "calculatedAt": now_iso(),
        "notice": "합성 점수 재현 모델이며 실제 침수 확률이 아닙니다.",
    }