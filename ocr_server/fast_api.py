# -*- coding: utf-8 -*-
"""ROUTEL AI 서버
실행: .\\venv\\Scripts\\python.exe -m uvicorn fast_api:app --host 0.0.0.0 --port 8000
     (또는 run.bat 더블클릭)
테스트 화면: http://localhost:8000/docs
침수는 다른 PC에서 따로 돌아요 (flood_server 폴더)
"""
import asyncio
import logging
import threading
import time
from contextlib import asynccontextmanager
from datetime import datetime

import cv2
import numpy as np
from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.responses import Response, StreamingResponse

import config
import spring
from plate_ocr import CameraWorker, create_reader, draw, reset_sync, to_jpg   # 번호판 인식 (YOLO + OCR)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(message)s", datefmt="%H:%M:%S")
log = logging.getLogger("server")

workers = {}                       # 서버가 켜질 때 한 번만 만들어 두는 모델/작업들
cameras = {}                       # 카메라 id -> CameraWorker
plate_job = {"stop": None, "startedAt": None}   # 카메라 작업 멈추는 신호 (None 이면 꺼져 있음) + 시작 시각
plate_lock = threading.Lock()      # 시작/정지 버튼을 연달아 눌러도 꼬이지 않게


def start_plate():
    """카메라 전부 새로 만들어서 같이 시작 (영상은 처음부터). 이미 돌고 있으면 그대로 두고 False"""
    with plate_lock:
        if plate_job["stop"] is not None:
            return False
        stop = threading.Event()
        reset_sync()
        cameras.clear()
        for camera_id, source in config.CAMERAS.items():
            cameras[camera_id] = CameraWorker(camera_id, source, workers["plate"])
            cameras[camera_id].start(stop)
        plate_job.update(stop=stop, startedAt=time.time())
        log.info("카메라 인식 시작: %s", list(cameras))
        return True


def stop_plate():
    """카메라 작업 멈춤. 이미 꺼져 있으면 False"""
    with plate_lock:
        stop = plate_job["stop"]
        if stop is None:
            return False
        stop.set()                 # 스레드는 하던 탐지/전송을 마치고 1초 안팎으로 끝나요
        cameras.clear()            # 스트림은 404 -> 멈춘 화면이 계속 보이지 않게
        plate_job.update(stop=None, startedAt=None)
        log.info("카메라 인식 정지")
        return True


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ===== 서버 켤 때 한 번만 =====
    workers["plate"] = create_reader()   # CPU 면 따로 띄운 프로세스에서 인식 (스트림 안 끊기게)
    log.info("번호판 모델(YOLO + OCR) 로드 완료")
    if config.PLATE_ENABLED:
        start_plate()
    else:
        log.info("카메라 인식은 꺼 둠 -> POST /control/plate/start 로 시작 (프론트 실행 버튼)")
    yield
    # ===== 서버 끌 때 =====
    stop_plate()


app = FastAPI(title="ROUTEL AI Server", lifespan=lifespan)


@app.get("/health", summary="서버 상태")
def health():
    return {"status": "ok", "spring": config.SPRING_URL, "loaded": list(workers),
            "plateRunning": plate_job["stop"] is not None,
            "cameras": {cid: c.running for cid, c in cameras.items()}}


# ---------------- 실행 버튼 (Spring 이 호출) ----------------
def _check_key(key):
    if key != config.INTERNAL_API_KEY:
        raise HTTPException(401, "X-Internal-Api-Key 가 달라요 (Spring puf.internal.api-key 와 같아야 함)")


def _plate_state():
    started = plate_job["startedAt"]
    return {"running": started is not None,
            "runningSec": round(time.time() - started, 1) if started else None,
            "cameras": [{"cameraId": c.camera_id, "running": c.running, "error": c.error} for c in cameras.values()]}


@app.get("/control/plate", summary="카메라 인식이 돌고 있는지 (버튼 상태 표시용)")
def control_plate_state():
    return _plate_state()


@app.post("/control/plate/start", summary="영상 처음부터 재생 + 번호판 인식/전송 시작")
def control_plate_start(x_internal_api_key: str = Header(None)):
    _check_key(x_internal_api_key)
    return {"started": start_plate(), **_plate_state()}


@app.post("/control/plate/stop", summary="영상 + 번호판 인식/전송 정지")
def control_plate_stop(x_internal_api_key: str = Header(None)):
    _check_key(x_internal_api_key)
    return {"stopped": stop_plate(), **_plate_state()}


# ---------------- 번호판 ----------------
def _decode(file: UploadFile):
    img = cv2.imdecode(np.frombuffer(file.file.read(), np.uint8), cv2.IMREAD_COLOR)
    if img is None:
        raise HTTPException(400, "이미지를 열 수 없어요 (jpg/png 파일인지 확인)")
    return img


@app.get("/plate/status", summary="카메라별 동작 상태 + 최근 전송 기록")
def plate_status():
    return [c.status() for c in cameras.values()]


@app.post("/plate/read", summary="사진을 올려 번호판 읽기 (Spring 저장 안 함)")
def plate_read(file: UploadFile = File(...)):
    plates = workers["plate"].read(_decode(file))
    return {"count": len(plates), "plates": plates}


@app.post("/plate/read-image", summary="사진을 올려 번호판 네모 그린 사진 받기 (Spring 저장 안 함)",
          response_class=Response, responses={200: {"content": {"image/jpeg": {}}}})
def plate_read_image(file: UploadFile = File(...)):
    img = _decode(file)
    return Response(to_jpg(draw(img, workers["plate"].read(img))), media_type="image/jpeg")


# ---------------- 시연 페이지 (front2) ----------------
@app.get("/demo/cameras", summary="시연 페이지 버튼용 카메라 목록")
def demo_cameras():
    return [{"role": role, "cameraId": camera_id} for role, camera_id in config.DEMO_CAMERAS.items()]


@app.post("/demo/recognize", summary="사진을 APPROACH/ROI 카메라에서 찍힌 것처럼 읽고 Spring 에 전송 (시연용)")
def demo_recognize(role: str = Form(...), file: UploadFile = File(...)):
    """카메라 루프와 달리 2번 확인/재전송 제한 없이 누를 때마다 바로 보내요.
    보내는 기준(형식 맞음 + OCR 자신감 OCR_MIN_SCORE 이상)은 카메라 루프와 같아요"""
    role = role.upper()
    camera_id = config.DEMO_CAMERAS.get(role)
    if camera_id is None:
        raise HTTPException(400, f"role 은 {list(config.DEMO_CAMERAS)} 중 하나여야 해요")
    img = _decode(file)
    timings = {}
    started = time.time()
    plates = workers["plate"].read(img, timings=timings)   # 카메라 인식과 같은 모델 (lock 으로 차례대로)
    elapsed_ms = round((time.time() - started) * 1000)
    send_started = time.time()
    results = []
    for p in plates:
        item = {**p, "sent": False}
        if not p["valid"]:
            item["skipReason"] = "번호판 형식 아님"
        elif p["score"] < config.OCR_MIN_SCORE:
            item["skipReason"] = f"OCR 자신감 낮음 (< {config.OCR_MIN_SCORE})"
        else:
            payload = {"cameraId": camera_id, "detectedNum": p["text"],
                       "confidence": round(min(max(p["score"], 0.0), 1.0), 3),
                       "detectedAt": datetime.now().strftime("%Y-%m-%dT%H:%M:%S")}
            try:
                res = spring.send_plate_log(payload, to_jpg(draw(img, plates, highlight=p["text"])))
                item.update(sent=True, plateLogId=res.get("id"), recognitionStatus=res.get("recognitionStatus"),
                            reviewStatus=res.get("reviewStatus"))
                log.info("[시연 %s · 카메라 %s] %s (%.3f) 전송 -> %s", role, camera_id, p["text"], p["score"],
                         res.get("recognitionStatus"))
            except Exception as e:
                item["error"] = str(e)
                log.warning("[시연 %s · 카메라 %s] %s 전송 실패: %s", role, camera_id, p["text"], e)
        results.append(item)
    timings["sendMs"] = round((time.time() - send_started) * 1000)
    return {"role": role, "cameraId": camera_id, "elapsedMs": elapsed_ms, "timings": timings,
            "imageSize": [img.shape[1], img.shape[0]], "count": len(results), "plates": results}


# ---------------- 관리자 CCTV 화면용 실시간 영상 ----------------
def _camera(camera_id):
    cam = cameras.get(camera_id)
    if cam is None:
        if plate_job["stop"] is None:
            raise HTTPException(404, "카메라 인식이 꺼져 있어요 (POST /control/plate/start 로 시작)")
        raise HTTPException(404, f"AI 서버에 연결된 카메라가 아니에요: {camera_id} (config.CAMERAS 확인)")
    return cam


@app.get("/stream/{camera_id}", summary="실시간 탐지 영상 (MJPEG). <img src> 에 바로 넣으면 영상처럼 보여요")
async def stream(camera_id: int):
    cam = _camera(camera_id)

    async def frames():
        last = None
        # 새 화면이 나오면 카메라 스레드가 깨워줌 (계속 확인하지 않음 -> 화면 만드는 스레드를 방해하지 않게)
        waiter = (asyncio.get_running_loop(), asyncio.Event())
        cam.waiters.add(waiter)
        try:
            while cameras.get(camera_id) is cam:     # 정지(또는 다시 시작)하면 이 스트림은 끝 -> 프론트가 새로 연결
                cam.last_view = time.time()          # "누가 보고 있음" 표시 -> 카메라가 화면(jpg)을 만들기 시작
                jpg = cam.jpg
                if jpg is not None and jpg is not last:
                    yield (b"--frame\r\nContent-Type: image/jpeg\r\nContent-Length: " + str(len(jpg)).encode()
                           + b"\r\n\r\n" + jpg + b"\r\n")
                    last = jpg
                waiter[1].clear()
                if cam.jpg is last:                  # 그 사이 새 화면이 없으면 깨워줄 때까지 (최대 0.5초) 기다림
                    try:
                        await asyncio.wait_for(waiter[1].wait(), 0.5)
                    except asyncio.TimeoutError:
                        pass
        finally:
            cam.waiters.discard(waiter)               # 창을 닫으면 여기로 와서 정리

    return StreamingResponse(frames(), media_type="multipart/x-mixed-replace; boundary=frame",
                             headers={"Cache-Control": "no-store"})


@app.get("/stream/{camera_id}/snapshot", summary="지금 화면 한 장 (jpg)",
         response_class=Response, responses={200: {"content": {"image/jpeg": {}}}})
def stream_snapshot(camera_id: int):
    jpg = _camera(camera_id).snapshot()
    if jpg is None:
        raise HTTPException(503, "아직 영상이 준비되지 않았어요 (잠시 후 다시)")
    return Response(jpg, media_type="image/jpeg", headers={"Cache-Control": "no-store"})
