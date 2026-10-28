import os
import random
from datetime import datetime, timedelta, timezone

import httpx
from pydantic import BaseModel, Field

from spring_client import send_plate_log, send_risk_score
from fastapi import FastAPI, File, Form, HTTPException, UploadFile

app = FastAPI(title="ROUTEL FastAPI")

OCR_URL = "http://127.0.0.1:8502/detect"


@app.post("/plates/from-image")
async def send_plates_from_image(
    cameraId: int = Form(..., gt=0),
    image: UploadFile = File(...),
):
    image_bytes = await image.read()

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            ocr_response = await client.post(
                OCR_URL,
                files={
                    "image": (
                        image.filename or "frame.jpg",
                        image_bytes,
                        image.content_type or "image/jpeg",
                    )
                },
            )
            ocr_response.raise_for_status()
    except httpx.HTTPError as error:
        raise HTTPException(
            status_code=502,
            detail=f"OCR 서버 연결 실패: {error}",
        ) from error

    detections = ocr_response.json()["detections"]
    sent = []

    for detection in detections:
        payload = {
            "cameraId": cameraId,
            "detectedNum": detection["detectedNum"],
            "confidence": detection["confidence"],
            "detectedAt": now_kst(),
        }

        try:
            spring_response = await send_plate_log(payload)
        except httpx.HTTPError as error:
            raise HTTPException(
                status_code=502,
                detail=f"Spring 전송 실패: {error}",
            ) from error

        sent.append({
            "sentData": payload,
            "springResponse": spring_response,
        })

    return {"detectedVehicles": len(detections), "sent": sent}

class RiskRequest(BaseModel):
    underpassId: int = Field(gt=0)
    rainfallMm: float | None = Field(default=None, ge=0)
    rainfall1hMm: float | None = Field(default=None, ge=0)
    rainfall3hMm: float | None = Field(default=None, ge=0)
    rainfall6hMm: float | None = Field(default=None, ge=0)
    rainfall12hMm: float | None = Field(default=None, ge=0)
    rainfall24hMm: float | None = Field(default=None, ge=0)


class PlateRequest(BaseModel):
    cameraId: int = Field(gt=0)


def now_kst() -> str:
    kst = timezone(timedelta(hours=9))
    return datetime.now(kst).replace(tzinfo=None).isoformat(timespec="seconds")


def predict_risk_stub() -> float:
    # 연동 테스트용 임시 점수. 실제 모델 연결 시 교체.
    return round(random.uniform(0, 100), 2)


def detect_plate_stub() -> dict:
    # OCR 연결 전 테스트용 결과
    return {"detectedNum": "12가3456", "confidence": 0.93}


def make_risk_payload(data: RiskRequest) -> dict:
    return {
        **data.model_dump(),
        "riskScore": predict_risk_stub(),
        "predictedAt": now_kst(),
    }


def make_plate_payload(data: PlateRequest) -> dict:
    return {
        "cameraId": data.cameraId,
        **detect_plate_stub(),
        "detectedAt": now_kst(),
    }


@app.get("/")
def root():
    return {"message": "FastAPI server is running"}


@app.post("/test/risk")
def test_risk(data: RiskRequest):
    return make_risk_payload(data)


@app.post("/test/plate")
def test_plate(data: PlateRequest):
    return make_plate_payload(data)


@app.post("/test/send-risk")
async def test_send_risk(data: RiskRequest):
    payload = make_risk_payload(data)
    try:
        spring_response = await send_risk_score(payload)
    except httpx.HTTPError as error:
        raise HTTPException(
            status_code=502,
            detail=f"Spring 전송 실패: {error}",
        ) from error

    return {
        "message": "위험도 데이터 전송 성공",
        "sentData": payload,
        "springResponse": spring_response,
    }


@app.post("/test/send-plate")
async def test_send_plate(data: PlateRequest):
    payload = make_plate_payload(data)
    try:
        spring_response = await send_plate_log(payload)
    except httpx.HTTPError as error:
        raise HTTPException(
            status_code=502,
            detail=f"Spring 전송 실패: {error}",
        ) from error

    return {
        "message": "번호판 데이터 전송 성공",
        "sentData": payload,
        "springResponse": spring_response,
    }

class FloodInput(BaseModel):
    지하차도명: str
    강수량_mm: float
    직전1시간_mm: float
    최근3시간_누적_mm: float
    최근6시간_누적_mm: float
    최근12시간_누적_mm: float
    최근24시간_누적_mm: float
    높이_m: float
    길이_m: int


@app.post("/predict/flood")
def predict_flood_endpoint(data: FloodInput):
    from flood_model import predict_flood

    values = data.model_dump(exclude={"지하차도명"})
    level = predict_flood(values)
    labels = {0: "안전", 1: "위험", 2: "침수"}

    return {
        "지하차도명": data.지하차도명,
        "위험단계": level,
        "상태": labels.get(level, "알 수 없음"),
    }

KMA_FORECAST_URL = (
    "https://apis.data.go.kr/1360000/"
    "VilageFcstInfoService_2.0/getUltraSrtFcst"
)


def latest_kma_forecast_time():
    kst = timezone(timedelta(hours=9))
    now = datetime.now(kst)

    # 초단기예보는 매시 30분에 발표되고, 보통 45분 이후 조회 가능
    base = now.replace(minute=30, second=0, microsecond=0)

    if now.minute < 45:
        base -= timedelta(hours=1)

    return base.strftime("%Y%m%d"), base.strftime("%H%M")


@app.get("/weather/ultra-short")
async def get_ultra_short_forecast(nx: int = 60, ny: int = 127):
    service_key = os.getenv("KMA_SERVICE_KEY")

    if not service_key:
        raise HTTPException(
            status_code=500,
            detail="KMA_SERVICE_KEY 환경변수가 설정되지 않았습니다.",
        )

    base_date, base_time = latest_kma_forecast_time()

    params = {
        "serviceKey": service_key,
        "numOfRows": 1000,
        "pageNo": 1,
        "dataType": "JSON",
        "base_date": base_date,
        "base_time": base_time,
        "nx": nx,
        "ny": ny,
    }

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.get(KMA_FORECAST_URL, params=params)
            response.raise_for_status()
            result = response.json()

    except httpx.HTTPStatusError as error:
        upstream_message = error.response.text[:500]
        if service_key in upstream_message:
            upstream_message = upstream_message.replace(service_key, "[숨김]")

        raise HTTPException(
            status_code=502,
            detail={
                "message": "기상청 서버가 요청을 거절했습니다.",
                "upstream_status": error.response.status_code,
                "upstream_message": upstream_message,
            },
        ) from error

    except httpx.HTTPError as error:
        raise HTTPException(
            status_code=502,
            detail=f"기상청 서버 연결 실패: {error}",
        ) from error

    body = result.get("response", {})
    header = body.get("header", {})
    result_code = str(header.get("resultCode", ""))

    if result_code not in {"00", "0"}:
        raise HTTPException(
            status_code=502,
            detail={
                "message": "기상청 API 오류",
                "resultCode": result_code,
                "resultMsg": header.get("resultMsg"),
            },
        )

    items = body.get("body", {}).get("items", {}).get("item", [])

    if isinstance(items, dict):
        items = [items]

    return {
        "baseDate": base_date,
        "baseTime": base_time,
        "nx": nx,
        "ny": ny,
        "forecast": items,
    }    