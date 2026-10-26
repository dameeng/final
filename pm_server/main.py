# -*- coding: utf-8 -*-
"""PUF 예지보전 AI 서버 (FastAPI) — CCTV · 배수펌프 · 수위센서 · 전광판

실행:  run.bat   (또는  venv\\Scripts\\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8002)
문서:  http://localhost:8002/docs

두 가지로 써요
  1) Spring 연동 (INTERNAL_API_KEY 가 있을 때 자동): 켜지면 백그라운드에서 지난 7일 점수를 채우고(backfill=true),
     이어서 주기적으로  Spring 에서 장비·센서 조회 -> 점수·근거·특징값 계산 -> Spring 에 점수 보내기  를 해요. (pdm/runner.py)
  2) 계산 API: 센서 데이터를 보내면 점수·근거·특징값을 응답으로 돌려줘요 (POST /predict/{종류}). 개발·확인용

모델 (pdm/model.py)
  CCTV · 배수펌프 : 이 폴더에서 학습 (train.py -> models/)
  수위센서 · 전광판: 팀원 최종 모델 그대로 (pdm/pm_final/ 코드 + models/)

엔드포인트
  GET  /health                       모델 상태
  GET  /spec                         종류별 입력 항목·간격·필요 개수 (요청 만들 때 참고)
  GET  /link/status                  Spring 연동 상태 (한 바퀴·오류·장비별 상태·백필 진행)
  POST /link/run-now | /link/backfill | /link/reset
  POST /predict/{cctv|pump|waterlevel|vms}         설비 1대
  POST /predict/{cctv|pump|waterlevel|vms}/batch   여러 대 한 번에
  POST /baseline/vms                 전광판 평소 값 만들기 (연동에서는 자동으로 하루 한 번)
"""
from __future__ import annotations

import os
import sys
import threading
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Any, Dict, List, Optional, Union

sys.dont_write_bytecode = True   # 폴더에 __pycache__ 를 만들지 않게

import config  # noqa: E402

# ----- OCR 서버가 느려지지 않게: numpy 등을 불러오기 전에 계산 스레드 수를 정해야 해요 -----
for _var in ("OMP_NUM_THREADS", "OPENBLAS_NUM_THREADS", "MKL_NUM_THREADS", "NUMEXPR_NUM_THREADS", "LOKY_MAX_CPU_COUNT"):
    os.environ.setdefault(_var, str(config.CPU_THREADS))


def _lower_priority():
    """이 프로세스를 '보통 미만' 우선순위로 (CPU 가 바쁠 때 OCR 이 먼저 써요)"""
    try:
        if os.name == "nt":
            import ctypes
            from ctypes import wintypes
            k32 = ctypes.WinDLL("kernel32", use_last_error=True)
            k32.GetCurrentProcess.restype = wintypes.HANDLE
            k32.SetPriorityClass.argtypes = [wintypes.HANDLE, wintypes.DWORD]
            k32.SetPriorityClass.restype = wintypes.BOOL
            BELOW_NORMAL_PRIORITY_CLASS = 0x00004000
            return bool(k32.SetPriorityClass(k32.GetCurrentProcess(), BELOW_NORMAL_PRIORITY_CLASS))
        os.nice(5)
        return True
    except Exception:
        return False


PRIORITY_LOWERED = _lower_priority() if config.LOW_PRIORITY else False

import logging  # noqa: E402
import warnings  # noqa: E402

import pandas as pd  # noqa: E402
from fastapi import FastAPI, HTTPException  # noqa: E402
from pydantic import BaseModel, Field  # noqa: E402

from pdm.features import INTERVAL, MODEL_SOURCE, SPECS, TIME_COL, TYPE_KO, TYPES  # noqa: E402
from pdm.model import Models  # noqa: E402
from pdm.runner import Runner  # noqa: E402
from pdm.spring_client import SpringClient  # noqa: E402

warnings.filterwarnings("ignore")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(message)s", datefmt="%H:%M:%S")
log = logging.getLogger("pdm")

models = Models()
log.info("모델 로드: %s | 실패: %s | 우선순위 낮춤: %s", ", ".join(models.bundles), models.errors or "없음",
         "예" if PRIORITY_LOWERED else "아니오")

# ----- Spring 연동: 켜질 때 백그라운드 스레드가 (백필 ->) 주기적으로 조회·계산·점수 보내기를 해요 -----
runner = None
if config.LINK_ENABLED and config.INTERNAL_API_KEY:
    runner = Runner(models, SpringClient(config.SPRING_URL, config.INTERNAL_API_KEY, config.HTTP_TIMEOUT),
                    poll_sec=config.POLL_SEC, backfill_days=config.BACKFILL_DAYS, backfill_step_min=config.BACKFILL_STEP_MIN)
elif config.LINK_ENABLED:
    log.warning("INTERNAL_API_KEY 가 비어 있어 Spring 연동을 켜지 않아요 (계산 API 만 동작). run.bat 에서 INTERNAL_API_KEY 를 정하세요")


@asynccontextmanager
async def lifespan(_app):
    thread = None
    if runner is not None:
        thread = threading.Thread(target=runner.loop, kwargs={"do_backfill": config.BACKFILL_ON_START},
                                  name="spring-link", daemon=True)
        thread.start()
        log.info("Spring 연동 시작: %s (한 바퀴 %d초, 백필 %s)", config.SPRING_URL, config.POLL_SEC,
                 "%d일/%d분 간격" % (config.BACKFILL_DAYS, config.BACKFILL_STEP_MIN) if config.BACKFILL_ON_START else "끔")
    yield
    if runner is not None:
        runner.stop_flag.set()


app = FastAPI(title="PUF 예지보전 AI 서버", version="4.0", lifespan=lifespan,
              description="센서 데이터를 받으면 점수(0~100)·등급·근거·특징값(features)을 돌려주고, "
                          "Spring 에서 장비·센서를 직접 가져와 점수를 보내기도 해요. CCTV · 배수펌프 · 수위센서 · 전광판")

PATH_TYPE = {"cctv": "CCTV", "pump": "PUMP", "waterlevel": "WATER_LEVEL", "vms": "DISPLAY"}
EXAMPLE = {   # /docs 에 보이는 요청 예시 (센서 값 한 줄)
    "CCTV": {"collected_at": "2026-04-01 10:00:00", "video_receive_rate": 99.1, "response_time_ms": 48.0,
             "packet_loss_rate": 0.15, "image_blur_score": 6.5},
    "PUMP": {"collected_at": "2026-10-24 10:00:10", "vibration": 980.1, "pressure": 1004.2, "temperature": 2.5,
             "current": 0.9, "flow": 36.9, "rpm": 37.3},
    "WATER_LEVEL": {"observed_at": "2026-10-24 10:05:00", "level_m": -7.0141},
    "DISPLAY": {"collected_at": "2026-10-24 10:00:00", "temperature_c": 37.5, "ambient_c": 22.8, "ripple_v": 0.0264,
                "response_time_ms": 45.5, "error_count": 0, "bad_pixel_pct": 0.0122},
}


# ------------------------------------------------------------------ 요청 모양
class Baseline(BaseModel):
    med: List[float] = Field(description="평소 중앙값 5개 (temp_gap, ripple_v, response_time_ms, error_count, bad_pixel_pct)")
    mad: List[float] = Field(description="평소 흔들림(MAD x 1.4826) 5개, 같은 순서")


class PredictRequest(BaseModel):
    equipmentId: Optional[Union[int, str]] = Field(None, description="설비 아이디 (응답에 그대로 돌려줘요)")
    readings: List[Dict[str, Any]] = Field(description="최근 센서 데이터, 한 줄 = 한 시각 (시각 열 + 센서 열). GET /spec 참고")
    now: Optional[datetime] = Field(None, description="지금 시각. 주면 최신 데이터가 너무 오래됐을 때 status=stale")
    baseline: Optional[Baseline] = Field(None, description="전광판만: 오늘의 평소 값 (POST /baseline/vms 결과)")


class BatchRequest(BaseModel):
    items: List[PredictRequest] = Field(description="설비 여러 대")


class BaselineRequest(BaseModel):
    equipmentId: Optional[Union[int, str]] = None
    readings: List[Dict[str, Any]] = Field(description="전광판 1대의 1시간 간격 이력 (권장 37일 이상, 최소 10일+7일)")
    now: Optional[datetime] = Field(None, description="기준 시각 (보통 오늘 0시). 없으면 마지막 데이터 시각")


# ------------------------------------------------------------------ 공통
def _etype(kind: str) -> str:
    etype = PATH_TYPE.get(kind.lower())
    if etype is None:
        raise HTTPException(404, "종류는 %s 중 하나예요" % ", ".join(PATH_TYPE))
    if not models.has(etype):
        raise HTTPException(503, "%s 모델이 로드되지 않았어요: %s" % (etype, models.errors.get(etype, "알 수 없음")))
    return etype


def _frame(etype: str, readings: List[Dict[str, Any]]) -> pd.DataFrame:
    df = pd.DataFrame(readings)
    tc = TIME_COL[etype]
    need = [tc] + list(SPECS[etype]["metrics"])
    missing = [c for c in need if c not in df.columns]
    if missing:
        raise HTTPException(422, "열이 없어요: %s (필요: %s)" % (", ".join(missing), ", ".join(need)))
    df = df[need].copy()
    df[tc] = pd.to_datetime(df[tc], errors="coerce")
    if df[tc].isna().any():
        raise HTTPException(422, "%s 에 시각이 아닌 값이 있어요" % tc)
    for c in need[1:]:
        df[c] = pd.to_numeric(df[c], errors="coerce")
    return df


def _one(etype: str, req: PredictRequest) -> dict:
    df = _frame(etype, req.readings)
    base = req.baseline.model_dump() if (etype == "DISPLAY" and req.baseline) else None
    return models.diagnose(etype, req.equipmentId, df, baseline=base, now=req.now)


# ------------------------------------------------------------------ 기본
@app.get("/health", tags=["기본"])
def health():
    """모델 4개 상태. 하나라도 못 불러오면 status=partial, 사유는 errors"""
    return {"status": "ok" if not models.errors else "partial", "errors": models.errors,
            "models": {t: {"typeKo": TYPE_KO[t], **models.meta[t]} for t in models.bundles}}


@app.get("/spec", tags=["기본"])
def spec():
    """종류별 요청 만드는 법: 시각 열 이름, 센서 열(이름·한글·단위), 데이터 간격, 최소 개수, 특징 이름"""
    out = {}
    for t in TYPES:
        s = SPECS[t]
        b = models.bundles.get(t, {})
        n = b.get("n_consec", 1)
        out[t] = {"path": "/predict/" + next(k for k, v in PATH_TYPE.items() if v == t), "typeKo": TYPE_KO[t],
                  "model": MODEL_SOURCE[t], "interval": INTERVAL[t], "timeColumn": TIME_COL[t],
                  "minRows": s["window"] + (n - 1 if MODEL_SOURCE[t] == "own" else 0),
                  "consecutive": n,
                  "metrics": [{"column": m, "name": v[0], "unit": v[1]} for m, v in s["metrics"].items()],
                  "features": [f[1] for f in s["features"]], "example": EXAMPLE[t]}
    out["WATER_LEVEL"]["minRows"] = 300      # 팀원 pdm_wl.MIN_ROWS
    out["DISPLAY"]["minRows"] = 24           # 팀원 pdm_vms.MIN_ROWS
    return out


# ------------------------------------------------------------------ Spring 연동
def _runner():
    if runner is None:
        raise HTTPException(503, "Spring 연동이 꺼져 있어요 (LINK_ENABLED=1 과 INTERNAL_API_KEY 를 정해 주세요)")
    return runner


@app.get("/link/status", tags=["Spring 연동"])
def link_status():
    """연동 상태: 한 바퀴 횟수·마지막 시각·마지막 오류, 장비별 상태(ok / insufficient_history / baseline_pending …), 백필 진행"""
    r = _runner()
    return {"springUrl": config.SPRING_URL, "pollSec": config.POLL_SEC, **r.info,
            "tracking": {str(k): (None if v is None else str(v)) for k, v in r.started.items() if v is not None}}


@app.post("/link/run-now", tags=["Spring 연동"])
def link_run_now():
    """한 바퀴를 지금 바로 돌려요 (조회 -> 계산 -> 점수 보내기). 보낸 점수 수를 돌려줘요"""
    r = _runner()
    return {"sent": r.cycle(), "lastError": r.info.get("lastError")}


@app.post("/link/backfill", tags=["Spring 연동"])
def link_backfill():
    """지난 N일 점수를 다시 채워요 (백그라운드). 이미 있는 시각은 Spring 이 건너뛰어서 여러 번 해도 안전해요. 진행은 /link/status 의 backfill"""
    r = _runner()
    if r.info.get("backfill", {}).get("state") == "running":
        raise HTTPException(409, "백필이 이미 돌고 있어요")
    threading.Thread(target=r.backfill, kwargs={"force": True}, name="spring-backfill", daemon=True).start()
    return {"started": True}


@app.post("/link/reset", tags=["Spring 연동"])
def link_reset():
    """메모리 캐시(센서 창·전광판 평소 값·이상 시작 시각)를 비워요. Spring 센서를 다시 채운 뒤(reset=true)에 부르세요"""
    _runner().reset()
    return {"reset": True}


# ------------------------------------------------------------------ 계산
@app.post("/predict/{kind}", tags=["계산"])
def predict(kind: str, req: PredictRequest):
    """설비 1대의 최근 센서 데이터 -> 점수·등급·근거. kind = cctv · pump · waterlevel · vms

    응답: equipment_id, status(ok / insufficient_history / insufficient_data / stale / baseline_pending), risk_score(0~100),
    risk_level, health_index(100-점수), reasons[{항목, 센서, 현재, 평소, 설명, 영향도}], warnings, anomaly_raw
    + suspected_cause(CCTV·펌프·전광판) / anomaly_type(수위) / sensors(펌프: 센서 6개 상태)"""
    return _one(_etype(kind), req)


@app.post("/predict/{kind}/batch", tags=["계산"])
def predict_batch(kind: str, req: BatchRequest):
    """여러 대 한 번에. results 순서 = 요청 순서. 한 대가 실패해도 나머지는 계산해요 (실패한 칸은 status=error)"""
    etype = _etype(kind)
    results = []
    for it in req.items:
        try:
            results.append(_one(etype, it))
        except HTTPException as e:
            results.append({"equipment_id": it.equipmentId, "status": "error", "risk_score": None, "warnings": [e.detail]})
    counts = pd.Series([r.get("risk_level") for r in results if r.get("risk_level")]).value_counts().to_dict()
    return {"count": len(results), "levelCounts": counts, "results": results}


@app.post("/baseline/vms", tags=["계산"])
def baseline_vms(req: BaselineRequest):
    """전광판 1대의 평소 값 (팀원 build_baseline 그대로: 7일 전까지의 30일). 하루 한 번 만들어 저장해 두고
    /predict/vms 의 baseline 으로 넘겨요. 이력이 모자라면 baseline=null (그 장비는 baseline_pending)"""
    _etype("vms")
    df = _frame("DISPLAY", req.readings)
    base = models.build_baseline(df, now=req.now)
    return {"equipmentId": req.equipmentId, "baseline": base, "status": "ok" if base else "insufficient_history"}
