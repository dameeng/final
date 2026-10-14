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
