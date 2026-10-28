# -*- coding: utf-8 -*-
"""예지보전 서버 설정. 값을 바꾸려면 여기를 고치거나, 같은 이름의 환경변수로 덮어쓰면 돼요."""
import os


def _env(name, default):
    return os.environ.get(name, default)


# ===== OCR 서버가 느려지지 않게 (같은 PC 에서 OCR 이 CPU 대부분을 써요) =====
CPU_THREADS = max(1, int(_env("CPU_THREADS", "1")))        # numpy 등 계산 스레드 수
LOW_PRIORITY = _env("LOW_PRIORITY", "1") == "1"            # 1 = 이 서버 프로세스를 '보통 미만' 우선순위로 (OCR 이 먼저 CPU 를 씀)


# ===== Spring 연동 (조회 -> 계산 -> 점수 보내기) =====
SPRING_URL = _env("SPRING_URL", "http://localhost:5555")       # Spring 서버 주소
INTERNAL_API_KEY = _env("INTERNAL_API_KEY", "")                # Spring puf.internal.api-key 와 같은 값. 비어 있으면 연동을 켜지 않아요
LINK_ENABLED = _env("LINK_ENABLED", "1") == "1"                # 0 = 연동 끔 (계산 API 만 씀)
POLL_SEC = max(5, int(_env("POLL_SEC", "10")))                 # 한 바퀴 간격(초). 새 센서가 없는 장비는 다시 계산하지 않아요
BACKFILL_ON_START = _env("BACKFILL_ON_START", "1") == "1"      # 켤 때 지난 N일 점수를 한 번 채움 (이미 있는 시각은 Spring 이 건너뜀)
BACKFILL_DAYS = max(1, int(_env("BACKFILL_DAYS", "7")))
BACKFILL_STEP_MIN = max(10, int(_env("BACKFILL_STEP_MIN", "60")))   # 백필 점수 간격(분)
HTTP_TIMEOUT = max(5, int(_env("HTTP_TIMEOUT", "60")))
