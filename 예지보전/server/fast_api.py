# -*- coding: utf-8 -*-
"""예지보전 서버 본체 (현재: 펌프).

서버가 켜지면 펌프 모델을 불러와요. API 확인/테스트: http://localhost:8003/docs
  GET  /pump/info         모델 정보 (필요한 센서, 임계값, 검증 성능)
  POST /pump/predict      센서 데이터(JSON) -> 4개 모델 결과
  POST /pump/predict-csv  센서 데이터(CSV 업로드) -> 4개 모델 결과
  GET  /pump/demo         저장된 과거 데이터로 시연 (?at=2018-06-28T18:00:00&hours=72)
"""
import logging
from contextlib import asynccontextmanager
from typing import Dict, List, Optional, Union

from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from pydantic import BaseModel, Field

from pump_service import InputError, PumpPredictor

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(message)s", datefmt="%H:%M:%S")
log = logging.getLogger("server")

pump = None


@asynccontextmanager
async def lifespan(app):
    global pump
    pump = PumpPredictor()       # 모델 파일이 없으면 여기서 안내 메시지와 함께 멈춰요
    log.info("펌프 모델 로드 완료 (센서 %d개, %d시간 조기경보)", len(pump.sensors), pump.horizon_h)
    yield


app = FastAPI(title="예지보전 서버", lifespan=lifespan)


def _run(fn, *args, **kwargs):
    try:
        return fn(*args, **kwargs)
    except InputError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/health")
def health():
    """서버 상태"""
    return {"status": "ok", "pumpModelLoaded": pump is not None}


@app.get("/pump/info")
def pump_info():
    """모델 정보: 필요한 센서 목록, 경보 임계값, 교차검증 성능"""
    return pump.info()


class PumpPredictRequest(BaseModel):
    readings: List[Dict[str, Union[str, float, None]]] = Field(
        ..., description="1분 단위 센서 기록. 각 항목에 timestamp 와 sensor_00 ~ sensor_51 (15, 50 제외). "
                         "기준선 계산을 위해 최근 72시간 이상 권장")
    lastHours: Optional[float] = Field(None, description="결과 series 를 마지막 N시간만 돌려줘요 (없으면 전체)")


@app.post("/pump/predict")
def pump_predict(req: PumpPredictRequest):
    """센서 데이터(JSON) -> latest(가장 최근 결과) + series(10분 단위 전체)"""
    return _run(lambda: pump.run(pump.from_records(req.readings), last_hours=req.lastHours))


@app.post("/pump/predict-csv")
async def pump_predict_csv(file: UploadFile = File(...), lastHours: Optional[float] = Query(None)):
    """센서 데이터 CSV 업로드 (pump_sensor.csv 와 같은 형식)"""
    content = await file.read()
    return _run(lambda: pump.run(pump.from_csv_bytes(content), last_hours=lastHours))


@app.get("/pump/demo")
def pump_demo(at: Optional[str] = Query(None, description="이 시각을 '지금'으로 봐요. 없으면 데이터 마지막 시각. "
                                                           "예) 2018-06-28T18:00:00 (고장 4시간 전)"),
              hours: float = Query(72, gt=0, le=24 * 14, description="돌려줄 기간(시간)")):
    """[시연용] 과거 펌프 데이터로 실시간처럼 계산. 첫 호출은 CSV 를 읽느라 10초쯤 걸려요"""
    return _run(pump.demo, at, hours)
