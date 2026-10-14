# -*- coding: utf-8 -*-
"""침수 예측 서버 설정. 값을 바꾸려면 여기를 고치거나, 같은 이름의 환경변수로 덮어쓰면 돼요."""
import os

HERE = os.path.dirname(os.path.abspath(__file__))

# ===== Spring 백엔드 =====
SPRING_URL = os.environ.get("SPRING_URL", "http://localhost:5555")
# application.properties 의 puf.internal.api-key 와 같아야 해요
INTERNAL_API_KEY = os.environ.get("INTERNAL_API_KEY", "dev-internal-key-change-me")
HTTP_TIMEOUT_SEC = float(os.environ.get("HTTP_TIMEOUT_SEC", "5"))

# ===== 침수 위험 자동 계산 =====
FLOOD_ENABLED = os.environ.get("FLOOD_ENABLED", "1") == "1"      # 0이면 자동 계산 끔 (수동 /flood/run 은 가능)

# ★ 몇 초마다 전체 지하차도를 계산해서 Spring 에 보낼지 (여기 숫자만 바꾸면 돼요) ★
#   예) 60 = 1분마다 / 300 = 5분마다 / 10 = 10초마다
#   관리자 화면은 2분 넘게 갱신이 없으면 "갱신 지연"으로 표시하니, 120 이하를 추천해요.
FLOOD_INTERVAL_SEC = max(1, int(os.environ.get("FLOOD_INTERVAL_SEC", "60")))

# 지하차도 상세/강수 조회를 동시에 몇 개씩 할지 (많을수록 빠르지만 Spring 에 부담)
FLOOD_WORKERS = max(1, int(os.environ.get("FLOOD_WORKERS", "8")))
# 목록 조회 한 번에 가져올 개수. Spring 이 최대 100개까지만 허용해요
UNDERPASS_PAGE_SIZE = 100

# ===== 침수모델 파일 위치 =====
# flood_server\침수모델\ 폴더 안에 flood_model.joblib 과 flood_model.py 를 같이 넣으세요 (이름 그대로)
FLOOD_DIR = os.environ.get("FLOOD_DIR", os.path.join(HERE, "침수모델"))
MODEL_FILE = "flood_model.joblib"

# Spring 서버 시간대와 같아야 해요 (predictedAt 에 시간대 없이 이 시각을 보냄)
TIMEZONE = os.environ.get("TIMEZONE", "Asia/Seoul")
