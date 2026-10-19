# -*- coding: utf-8 -*-
"""예지보전 서버 설정. 값을 바꾸려면 여기를 고치거나, 같은 이름의 환경변수로 덮어쓰면 돼요."""
import os

HERE = os.path.dirname(os.path.abspath(__file__))

# ===== 펌프 모델 위치 =====
# 예지보전\pump 폴더의 코드(data_prep/features/models)와 models\pump_models.joblib 을 그대로 불러와요.
# 모델을 다시 학습하면(python train.py) 서버만 재시작하면 돼요.
PUMP_DIR = os.environ.get("PUMP_DIR", os.path.join(HERE, "..", "pump"))
PUMP_MODEL_FILE = os.path.join(PUMP_DIR, "models", "pump_models.joblib")
PUMP_METRICS_FILE = os.path.join(PUMP_DIR, "outputs", "metrics.json")

# ===== 데모용 데이터 =====
# 실제 센서가 없어서, /pump/demo 는 이 CSV 의 과거 데이터를 "그 시각 기준 실시간"처럼 계산해요.
# 처음 호출할 때 한 번 읽어서(약 10초) 메모리에 둬요.
PUMP_DEMO_CSV = os.environ.get("PUMP_DEMO_CSV", os.path.join(HERE, "..", "pump_sensor.csv"))

# 한 번에 받을 수 있는 최대 원본 행 수 (1분 단위 기준 30일)
MAX_INPUT_ROWS = int(os.environ.get("MAX_INPUT_ROWS", str(60 * 24 * 30)))
