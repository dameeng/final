# -*- coding: utf-8 -*-
"""펌프 예지보전: 모델 로드 + 센서 데이터 → 4개 모델 결과.

결과(10분 단위 한 줄):
  ① anomalyScore         이상 점수 0~1 (평소 패턴과 얼마나 다른지)
  ② failProb             failHorizonH 시간 안에 고장 날 확률
  ③ rulH                 고장까지 남은 시간 추정 (최대 168h)
  ④ causeSensorsModel    ②를 올린 센서 Top3 / causeSensorsAnomaly: ①에서 가장 벗어난 센서 Top3
  riskLevel              정상 / 주의 / 위험
"""
import io
import json
import logging
import os
import sys
import threading

import numpy as np
import pandas as pd

import config

log = logging.getLogger("pump")


class InputError(ValueError):
    """입력 데이터 문제 (API 에서 400 으로 응답)"""


def _load_pump_modules():
    if not os.path.isfile(config.PUMP_MODEL_FILE):
        raise FileNotFoundError(
            "펌프 모델 파일이 없어요. 예지보전\\pump 폴더에서 아래 순서로 학습하세요:\n"
            "  python data_prep.py\n  python train.py\n찾은 위치: " + config.PUMP_MODEL_FILE)
    pump_dir = os.path.abspath(config.PUMP_DIR)
    if pump_dir not in sys.path:
        sys.path.insert(0, pump_dir)
    import data_prep  # noqa: F401
    import predict  # noqa: F401  (joblib 이 모델 클래스를 찾으려면 pump 모듈이 먼저 불려 있어야 해요)
    return data_prep, predict


def _clean(v):
    """JSON 으로 못 보내는 NaN/numpy 값 정리"""
    if v is None:
        return None
    if isinstance(v, (float, np.floating)):
        return None if np.isnan(v) else round(float(v), 4)
    if isinstance(v, np.integer):
        return int(v)
    return v


class PumpPredictor:

    def __init__(self):
        import joblib
        self._data_prep, self._predict = _load_pump_modules()
        self.bundle = joblib.load(config.PUMP_MODEL_FILE)
        self.sensors = self.bundle["sensors"]
        pc = sys.modules["pump_config"]
        self.horizon_h = pc.HORIZON_H
        self.baseline_h = pc.BASELINE_H
        self.rul_cap_h = pc.RUL_CAP_H
        self._demo_raw = None
        self._demo_lock = threading.Lock()

    # ---------- 정보 ----------
    def info(self):
        metrics = None
        if os.path.isfile(config.PUMP_METRICS_FILE):
            with open(config.PUMP_METRICS_FILE, encoding="utf-8") as fp:
                metrics = json.load(fp).get("overall")
        return {
            "failHorizonH": self.horizon_h,
            "rulCapH": self.rul_cap_h,
            "recommendedHistoryH": self.baseline_h,
            "requiredSensors": self.sensors,
            "thresholds": self.bundle["thresholds"],
            "cvMetrics": metrics,
        }

    # ---------- 입력 정리 ----------
    def _to_raw(self, df):
        if "timestamp" not in df.columns:
            raise InputError("timestamp 열이 없어요")
        missing = [s for s in self.sensors if s not in df.columns]
        if missing:
            raise InputError("센서 열이 빠졌어요: " + ", ".join(missing))
        if len(df) > config.MAX_INPUT_ROWS:
            raise InputError("행이 너무 많아요 (%d > %d)" % (len(df), config.MAX_INPUT_ROWS))
        df = df.drop(columns=[c for c in df.columns if str(c).startswith("Unnamed")])
        df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce")
        df = df.dropna(subset=["timestamp"])
        if df.empty:
            raise InputError("시각을 읽을 수 있는 행이 없어요")
        df[self.sensors] = df[self.sensors].apply(pd.to_numeric, errors="coerce")
        if df[self.sensors].isna().all().any():
            empty = [s for s in self.sensors if df[s].isna().all()]
            raise InputError("값이 하나도 없는 센서가 있어요: " + ", ".join(empty))
        return df.set_index("timestamp").sort_index()

    def from_records(self, records):
        return self._to_raw(pd.DataFrame(records))

    def from_csv_bytes(self, content):
        try:
            df = pd.read_csv(io.BytesIO(content), encoding="utf-8-sig")
        except Exception as e:
            raise InputError("CSV 를 읽을 수 없어요: %s" % e)
        return self._to_raw(df)

    # ---------- 계산 ----------
    def run(self, raw, last_hours=None):
        out = self._predict.predict(raw, self.bundle)
        if last_hours:
            out = out[out.index > out.index[-1] - pd.Timedelta(hours=last_hours)]
        prob_col = "fail_prob_%dh" % self.horizon_h
        rows = []
        for ts, r in out.iterrows():
            rows.append({
                "timestamp": ts.isoformat(timespec="seconds"),
                "anomalyScore": _clean(r["anomaly_score"]),
                "failProb": _clean(r[prob_col]),
                "rulH": _clean(r["rul_h"]),
                "riskLevel": r["risk_level"],
                "causeSensorsModel": r["cause_sensors_clf"].split(","),
                "causeSensorsAnomaly": r["cause_sensors_anomaly"].split(","),
                "status": r.get("status") if isinstance(r.get("status"), str) else None,
            })
        history_h = (raw.index[-1] - raw.index[0]).total_seconds() / 3600
        warnings = []
        if history_h < self.baseline_h:
            warnings.append("이력이 %.0f시간뿐이에요. 기준선 계산에 %d시간 이상을 권장해요 (결과 신뢰도 낮음)"
                            % (history_h, self.baseline_h))
        return {
            "failHorizonH": self.horizon_h,
            "historyHours": round(history_h, 1),
            "warnings": warnings,
            "latest": rows[-1] if rows else None,
            "series": rows,
        }

    # ---------- 데모 ----------
    def _demo_data(self):
        with self._demo_lock:
            if self._demo_raw is None:
                if not os.path.isfile(config.PUMP_DEMO_CSV):
                    raise FileNotFoundError("데모 CSV 가 없어요: " + config.PUMP_DEMO_CSV)
                log.info("데모 CSV 읽는 중... (%s)", config.PUMP_DEMO_CSV)
                self._demo_raw = self._data_prep.load_raw(config.PUMP_DEMO_CSV)
                log.info("데모 CSV 로드 완료 (%d행)", len(self._demo_raw))
            return self._demo_raw

    def demo(self, at=None, hours=72):
        """과거 데이터에서 at 시각을 '지금'으로 보고, 직전 hours 시간의 결과를 계산"""
        raw = self._demo_data()
        at = pd.Timestamp(at) if at else raw.index[-1]
        if not (raw.index[0] < at <= raw.index[-1]):
            raise InputError("at 은 %s ~ %s 사이여야 해요" % (raw.index[0], raw.index[-1]))
        start = at - pd.Timedelta(hours=hours + self.baseline_h)
        result = self.run(raw.loc[start:at], last_hours=hours)
        result["demoRange"] = {"from": raw.index[0].isoformat(), "to": raw.index[-1].isoformat()}
        return result
