# -*- coding: utf-8 -*-
"""설비 종류별 센서 항목과 시계열 특징 정의 + 특징 추출.

CCTV·펌프: 설비 1대의 최근 센서값 N개(시간 순서, 항목별 열)를 받아서 특징값 3~5개를 만들어요 (sliding).
특징은 '한 시점 값'이 아니라 '최근 N개의 흐름'에서 계산해요: 평균 수준, 추세(기울기), 변동성, 최대값, 튐 정도 등.
학습(train.py)과 서버 점수 계산(cctv.py·pump.py)이 이 파일을 기준으로 써요. 수위·전광판은 /spec 안내용 정보만 있어요.

특징의 재료(source)
  - 항목 이름          : 그 센서값 그대로
  - "g:<그룹>"         : 그 그룹 센서들이 평소와 다른 정도 = 시각마다 |z| 평균  (z = (값 - 평소 평균) / 평소 표준편차)
  - "out"              : 시각마다 평소 범위(|z| > OUT_Z)를 벗어난 센서 비율(%)
  평소 평균·표준편차(baseline)는 train.py 가 정상 구간에서 구해 모델 파일에 저장해요.
"""
import numpy as np
import pandas as pd

TYPES = ["CCTV", "PUMP", "WATER_LEVEL", "DISPLAY"]
TYPE_KO = {"CCTV": "CCTV", "PUMP": "배수펌프", "WATER_LEVEL": "수위센서", "DISPLAY": "전광판"}
# 모델 출처: own = 이 폴더에서 학습 (cctv.py·pump.py), pm_final = 팀원 최종 모델 그대로 (pdm/pm_final/pdm_wl.py·pdm_vms.py)
MODEL_SOURCE = {"CCTV": "own", "PUMP": "own", "WATER_LEVEL": "pm_final", "DISPLAY": "pm_final"}
# 입력 데이터 간격 (안내용). 팀원 모델(수위·전광판)은 이 간격이 맞아야 해요 (빠진 시각은 빈 값으로 계산)
INTERVAL = {"CCTV": "1시간", "PUMP": "10초", "WATER_LEVEL": "5분", "DISPLAY": "1시간"}
TIME_COL = {"CCTV": "collected_at", "PUMP": "collected_at", "WATER_LEVEL": "observed_at", "DISPLAY": "collected_at"}
OUT_Z = 3.0


# ------------------------------------------------------------------ 통계 함수 (x = 시간 순서 값 배열)
def _slope(x):
    """한 칸(측정 1번)마다 얼마나 오르내리는지 (최소제곱 직선 기울기)"""
    t = np.arange(len(x), dtype=float)
    t -= t.mean()
    return float(np.dot(t, x - x.mean()) / np.dot(t, t))


STATS = {
    "mean": lambda x: float(np.mean(x)),
    "std": lambda x: float(np.std(x)),
    "max": lambda x: float(np.max(x)),
    "slope": _slope,
    "diff_std": lambda x: float(np.std(np.diff(x))),           # 이웃한 측정값 차이의 표준편차 = 측정 잡음
    "diff_absmax": lambda x: float(np.max(np.abs(np.diff(x)))),  # 이웃한 측정값 차이 중 가장 큰 것 = 튀는 값
    "range": lambda x: float(np.max(x) - np.min(x)),
}

# ------------------------------------------------------------------ 배수펌프 센서 6개 (종류마다 1개)
# 원본(펌프 시연 CSV)은 sensor_00 ~ sensor_49 처럼 이름이 없어서, 화면용 이름·종류는 임의로 붙였어요 (실제 의미와 무관).
# 종류마다 고장 구간에서 평소와 가장 크게 달라지는 센서 하나를 골랐어요 (진동은 고장 직전 신호도 큰 sensor_23).
# 값은 원본 숫자 그대로라 단위는 붙이지 않아요. 원본은 1분 간격이고, 10초 간격으로 가공해서 써요 (samples.py).
PUMP_SENSORS = [   # (그룹 키, pm_sensor.metric, 한글, 원본 센서 번호)
    ("vib", "vibration", "진동센서", 23),
    ("press", "pressure", "압력센서", 28),
    ("temp", "temperature", "온도센서", 0),
    ("curr", "current", "전류센서", 13),
    ("flow", "flow", "유량센서", 42),
    ("rpm", "rpm", "회전수센서", 45),
]
PUMP_COLUMNS = {m: "sensor_%02d" % n for _, m, _, n in PUMP_SENSORS}     # pm_sensor.metric -> 원본 CSV 열
_pump_metrics = {m: (ko, "", (0, None), g) for g, m, ko, _ in PUMP_SENSORS}

# ------------------------------------------------------------------ 종류별 정의
# metrics : pm_sensor.metric 에 저장하는 항목 -> (한글, 단위, 값 범위, 그룹)
# window  : 특징을 계산할 최근 측정 개수
# features: (키, 한글 이름, 재료, 통계, 나쁜 방향)  나쁜 방향 = up(높을수록 나쁨) / down(낮을수록 나쁨) / both
SPECS = {
    "CCTV": {
        "window": 12,
        "metrics": {
            "video_receive_rate": ("영상 수신률", "%", (0, 100), None),
            "response_time_ms": ("응답 시간", "ms", (0, None), None),
            "packet_loss_rate": ("패킷 손실률", "%", (0, 100), None),
            "image_blur_score": ("화면 흐림", "점", (0, 100), None),
        },
        "features": [
            ("receive_mean", "영상 수신률 평균", "video_receive_rate", "mean", "down"),
            ("response_mean", "응답 시간 평균", "response_time_ms", "mean", "up"),
            ("response_trend", "응답 시간 증가 추세", "response_time_ms", "slope", "up"),
            ("loss_mean", "패킷 손실률 평균", "packet_loss_rate", "mean", "up"),
            ("blur_max", "화면 흐림 최대", "image_blur_score", "max", "up"),
        ],
    },
    "PUMP": {
        "window": 30,       # 10초 간격 30개 = 최근 5분
        "metrics": _pump_metrics,
        "features": [
            ("vib_level", "진동 이상 정도", "g:vib", "mean", "up"),
            ("vib_vol", "진동 변동성", "g:vib", "std", "up"),
            ("press_level", "압력 이상 정도", "g:press", "mean", "up"),
            ("temp_trend", "온도 변화 추세", "g:temp", "slope", "both"),
            ("out_share", "평소 범위를 벗어난 센서 비율", "out", "mean", "up"),
        ],
    },
    # ---- 팀원 모델 (pm_final): 특징 계산은 팀원 코드가 해요. 여기 features 는 이름 안내(/spec)용이에요
    "WATER_LEVEL": {
        "window": 300,      # 5분 간격 최소 300개 (권장 2~3일)
        "metrics": {
            "level_m": ("측정 수위", "m", (None, None), None),
        },
        "features": [
            ("res_max3", "최근 15분 최대 이탈폭", "level_m", "pm_final", "up"),
            ("res_max12", "최근 1시간 최대 이탈폭", "level_m", "pm_final", "up"),
            ("res_sd12", "최근 1시간 흔들림", "level_m", "pm_final", "up"),
            ("slope_dev", "1시간 기울기와 6시간 기울기 차이", "level_m", "pm_final", "up"),
            ("slope24", "24시간 기울기", "level_m", "pm_final", "up"),
        ],
    },
    "DISPLAY": {
        "window": 24,       # 1시간 간격 최소 24시간 (권장 72시간). 평소 값은 37일 이력으로 하루 한 번 (build_baseline)
        "metrics": {
            "temperature_c": ("본체 온도", "℃", (-30, 80), None),
            "ambient_c": ("외기 온도", "℃", (-40, 60), None),
            "ripple_v": ("전원 리플", "V", (0, 5), None),
            "response_time_ms": ("응답 시간", "ms", (0, 5000), None),
            "error_count": ("오류 횟수", "건", (0, 10000), None),
            "bad_pixel_pct": ("불량 화소 비율", "%", (0, 100), None),
        },
        "features": [
            ("temp_gap", "본체-외기 온도차", "temperature_c", "pm_final", "up"),
            ("ripple_v", "전원 리플", "ripple_v", "pm_final", "up"),
            ("response_time_ms", "응답 시간", "response_time_ms", "pm_final", "up"),
            ("error_count", "오류 횟수", "error_count", "pm_final", "up"),
            ("bad_pixel_pct", "불량 화소 비율", "bad_pixel_pct", "pm_final", "up"),
        ],
    },
}

# 학습 데이터는 소수 3자리로 맞춰요 (pm_sensor.value 가 DECIMAL(12,3))
DECIMALS = 3


def metrics_of(etype):
    return list(SPECS[etype]["metrics"])


def metric_ko(etype, metric):
    return SPECS[etype]["metrics"][metric][0]


def group_metrics(etype, group):
    return [m for m, v in SPECS[etype]["metrics"].items() if v[3] == group]



def window_of(etype):
    return SPECS[etype]["window"]





def baseline_of(etype, normal_frames):
    """정상 구간들에서 항목별 (평균, 표준편차)"""
    d = pd.concat(normal_frames)[metrics_of(etype)].astype(float)
    return {"mu": d.mean().to_dict(), "sd": d.std().clip(lower=1e-6).to_dict()}


def zscores(etype, w, baseline):
    """항목별 z (평소 평균·표준편차 기준) DataFrame"""
    cols = metrics_of(etype)
    mu = pd.Series(baseline["mu"])[cols]
    sd = pd.Series(baseline["sd"])[cols]
    return (w[cols] - mu) / sd



def _sources(etype, w, baseline):
    """특징 재료별 시간 순서 배열 {재료: 배열}"""
    srcs = {f[2] for f in SPECS[etype]["features"]}
    z = zscores(etype, w, baseline).abs() if any(s == "out" or s.startswith("g:") for s in srcs) else None
    out = {}
    for s in srcs:
        if s == "out":
            out[s] = ((z > OUT_Z).mean(axis=1) * 100).to_numpy(dtype=float)
        elif s.startswith("g:"):
            out[s] = z[group_metrics(etype, s[2:])].mean(axis=1).to_numpy(dtype=float)
        else:
            out[s] = w[s].to_numpy(dtype=float)
    return out




def sliding(etype, wide, step=1, baseline=None):
    """학습용: 연속 측정값에서 window 개씩 밀면서 특징 행렬 (끝 위치 목록도 같이)"""
    spec = SPECS[etype]
    n = spec["window"]
    src = _sources(etype, wide, baseline)
    rows, ends = [], []
    for e in range(n, len(wide) + 1, step):
        rows.append([STATS[stat](src[source][e - n:e]) for _, _, source, stat, _ in spec["features"]])
        ends.append(e - 1)
    return np.array(rows, dtype=float).reshape(-1, len(spec["features"])), ends
