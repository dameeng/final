from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
RAW_CSV = BASE_DIR.parent / "pump_sensor.csv"
DATA_DIR = BASE_DIR / "data"
MODEL_DIR = BASE_DIR / "models"
OUT_DIR = BASE_DIR / "outputs"

# sensor_15: 100% 결측, sensor_50: 35% 결측
DROP_SENSORS = ["sensor_15", "sensor_50"]

RESAMPLE = "10min"
STEPS_PER_HOUR = 6

BASELINE_H = 72       # 센서별 "최근 정상 기준선" 창. 운전 구간마다 기준값이 달라져 절대값 대신 편차를 사용
HORIZON_H = 6         # ② 조기경보: N시간 내 고장 여부 (2/6/12/24h 비교 결과 6h만 의미 있는 신호)
RUL_CAP_H = 168       # ③ RUL 상한 (7일 이상은 "충분히 건강"으로 간주)
ALARM_WINDOW_H = 48   # 리드타임 평가 구간 / 이상탐지 학습 시 제외 구간

# 경보 임계값은 고정값 대신 교차검증 예측의 "고장과 무관한 구간" 분포에서 결정
# → 정상 운전 시간의 1%만 '위험', 5%만 '주의'로 울리도록
ALARM_QUANTILE = 0.99
WARN_QUANTILE = 0.95
SEED = 42
