# -*- coding: utf-8 -*-
"""침수 위험 예측 + 주기적 자동 계산.

흐름 (FLOOD_INTERVAL_SEC 마다 반복):
  1) 지하차도 목록 조회
  2) 지하차도마다 상세(높이/길이) + 강수 6개 조회  (동시에 여러 개)
  3) 침수모델로 한꺼번에 계산
  4) 지하차도마다 Spring 에 위험점수 전송
  5) (FORECAST_ENABLED) 예보 강수로 앞으로 FORECAST_HOURS 시간의 점수도 같은 모델로 계산해 risk-forecasts 로 전송

원칙: "지금 시점의 실제 값"만 보내요. 강수를 못 가져왔거나 높이/길이가 없으면 가짜 값(0점 등)을
      보내지 않고 건너뛰어요 (Spring 이 위험 등급을 잘못 바꾸지 않도록).
      미래 점수는 risk-scores 가 아니라 risk-forecasts 로만 보내서 현재 등급에는 영향을 주지 않아요.

미래 시점의 강수 6개 만드는 법 (future_inputs):
  Spring 강수 API 는 누적값만 줘서, 과거 24시간을 시간별로 되돌려 추정한 뒤 예보를 뒤에 이어 붙여요.
    지금 시간 = 강수량, 1시간 전 = 직전1시간, 2시간 전 = 3시간 누적 - 두 값   (정확)
    3~5시간 전 = (6시간 - 3시간 누적) / 3, 6~11시간 전 = (12시간 - 6시간) / 6, 12~23시간 전 = (24시간 - 12시간) / 12   (고르게 나눈 근사)
  k 시간 뒤의 누적 = 이 시간별 줄에서 k 시간 뒤를 끝으로 하는 구간의 합
"""
import logging
import os
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime

import config
import spring

log = logging.getLogger("flood")

try:
    from zoneinfo import ZoneInfo
    _TZ = ZoneInfo(config.TIMEZONE)
except Exception:   # tzdata 가 없으면 PC 시간 그대로 사용
    _TZ = None

# Spring 강수 필드 -> 모델 입력 열 (1:1)
RAIN_FIELDS = [
    ("rainfallMm", "강수량_mm"),
    ("rainfall1hMm", "직전1시간_mm"),
    ("rainfall3hMm", "최근3시간_누적_mm"),
    ("rainfall6hMm", "최근6시간_누적_mm"),
    ("rainfall12hMm", "최근12시간_누적_mm"),
    ("rainfall24hMm", "최근24시간_누적_mm"),
]
MODEL_COLUMNS = [col for _, col in RAIN_FIELDS] + ["높이_m", "길이_m"]
LEVEL_NAMES = {0: "안전", 1: "위험", 2: "침수"}


def now_iso():
    """Spring 형식(시간대 없이 YYYY-MM-DDTHH:MM:SS)의 지금 시각"""
    now = datetime.now(_TZ) if _TZ else datetime.now()
    return now.replace(tzinfo=None).isoformat(timespec="seconds")


def _iso_after(seconds):
    """지금부터 seconds 초 뒤의 시각 (다음 실행 예정 표시용)"""
    t = datetime.fromtimestamp(time.time() + seconds, _TZ)
    return t.replace(tzinfo=None).isoformat(timespec="seconds")


def _num(v):
    return None if v is None else float(v)


def _past_hours(rain):
    """지금 강수 6개(누적값) -> 과거 24시간 시간별 강수 추정 [23시간 전, ..., 1시간 전, 지금]"""
    r = {field: float(rain.get(field) or 0.0) for field, _ in RAIN_FIELDS}
    now, prev1 = r["rainfallMm"], r["rainfall1hMm"]
    prev2 = max(0.0, r["rainfall3hMm"] - now - prev1)
    h3_5 = max(0.0, r["rainfall6hMm"] - r["rainfall3hMm"]) / 3
    h6_11 = max(0.0, r["rainfall12hMm"] - r["rainfall6hMm"]) / 6
    h12_23 = max(0.0, r["rainfall24hMm"] - r["rainfall12hMm"]) / 12
    return [h12_23] * 12 + [h6_11] * 6 + [h3_5] * 3 + [prev2, prev1, now]


def future_inputs(rain, forecast, hours):
    """예보 앞쪽 hours 개 시점마다 모델 입력용 강수 6개를 만들어요 -> [(targetAt, {rainfallMm..}), ...]"""
    series = _past_hours(rain)
    out = []
    for f in forecast[:hours]:
        series.append(float(f.get("rainfallMm") or 0.0))
        i = len(series)
        out.append((f.get("targetAt"), {
            "rainfallMm": series[i - 1],
            "rainfall1hMm": series[i - 2],
            "rainfall3hMm": sum(series[i - 3:i]),
            "rainfall6hMm": sum(series[i - 6:i]),
            "rainfall12hMm": sum(series[i - 12:i]),
            "rainfall24hMm": sum(series[i - 24:i]),
        }))
    return out


class FloodPredictor:

    def __init__(self):
        flood_dir = config.FLOOD_DIR
        model_path = os.path.join(flood_dir, config.MODEL_FILE)
        if not os.path.isfile(model_path) or not os.path.isfile(os.path.join(flood_dir, "flood_model.py")):
            raise FileNotFoundError(
                "침수모델 파일이 없어요. 아래 폴더에 flood_model.joblib 과 flood_model.py 를 같이 넣어주세요:\n  " + flood_dir)
        if flood_dir not in sys.path:
            sys.path.insert(0, flood_dir)
        import flood_model  # noqa: F401  (joblib 이 모델 클래스를 찾으려면 먼저 불러와야 해요)
        import joblib
        self.model = joblib.load(model_path)

        self._lock = threading.Lock()   # 자동 실행과 수동 실행(/flood/run)이 겹치지 않게
        self.last_run = None
        self.next_run_at = None

    # ---------- 점수 계산 ----------
    def predict(self, rows):
        """rows: [{rainfallMm.., heightM, lengthM}, ...] -> [{riskScore, riskLevel}, ...]"""
        import pandas as pd
        data = []
        for r in rows:
            row = {col: float(r.get(field) or 0.0) for field, col in RAIN_FIELDS}   # 강수 null 은 계산할 때만 0
            row["높이_m"] = float(r["heightM"])
            row["길이_m"] = float(r["lengthM"])
            data.append(row)
        out = self.model.predict(pd.DataFrame(data, columns=MODEL_COLUMNS))
        scores = out["위험점수"].tolist()
        levels = out["위험단계"].tolist()
        return [{"riskScore": min(100.0, max(0.0, round(float(s), 2))), "riskLevel": int(l)}
                for s, l in zip(scores, levels)]

    # ---------- 한 바퀴 ----------
    def run_once(self):
        with self._lock:
            return self._run_once()

    def _collect(self, u):
        """지하차도 1개의 상세 + 강수 조회. 항상 item 딕셔너리를 돌려줌 (예외를 밖으로 안 던짐)"""
        uid = u.get("id")
        item = {"underpassId": uid, "name": u.get("name"), "status": "ready"}
        try:
            detail = spring.get_underpass(uid)
            height, length = detail.get("heightM"), detail.get("lengthM")
            if height is None or length is None:
                item.update(status="skipped", reason="높이/길이 없음")
                return item
            rain = spring.get_rainfall(uid)
            if rain.get("rainfallMm") is None or rain.get("observedAt") is None:
                item.update(status="skipped", reason="강수 관측값 없음")
                return item
            item["input"] = {field: _num(rain.get(field)) for field, _ in RAIN_FIELDS}
            item["input"]["heightM"] = float(height)
            item["input"]["lengthM"] = float(length)
            item["observedAt"] = rain.get("observedAt")
            if config.FORECAST_ENABLED:
                try:
                    forecast = spring.get_forecast(uid)
                    item["future"] = [(at, dict(r, heightM=float(height), lengthM=float(length)))
                                      for at, r in future_inputs(rain, forecast, config.FORECAST_HOURS) if at]
                except Exception as e:   # 예보를 못 가져와도 지금 점수는 그대로 보내요
                    item["forecastStatus"] = "failed"
                    item["forecastReason"] = str(e)
        except spring.SpringError as e:
            item.update(status="failed", reason=str(e))
        except Exception as e:   # 예상 못 한 오류도 이 지하차도만 실패로 처리
            item.update(status="failed", reason="%s: %s" % (type(e).__name__, e))
        return item

    def _send(self, item, predicted_at):
        payload = {"underpassId": item["underpassId"], "riskScore": item["riskScore"], "predictedAt": predicted_at}
        for field, _ in RAIN_FIELDS:
            payload[field] = item["input"][field]
        try:
            spring.send_risk_score(payload)
            item["status"] = "sent"
        except spring.SpringError as e:
            item.update(status="failed", reason=str(e))
        except Exception as e:
            item.update(status="failed", reason="%s: %s" % (type(e).__name__, e))

    def _send_forecast(self, item, predicted_at):
        points = []
        for (at, r), p in zip(item["future"], item["futurePreds"]):
            point = {"targetAt": at, "riskScore": p["riskScore"]}
            point.update({field: round(r[field], 2) for field, _ in RAIN_FIELDS})
            points.append(point)
        try:
            spring.send_risk_forecast({"underpassId": item["underpassId"], "predictedAt": predicted_at, "items": points})
            item["forecastStatus"] = "sent"
            item["forecastScores"] = [pt["riskScore"] for pt in points]
        except Exception as e:
            item["forecastStatus"] = "failed"
            item["forecastReason"] = str(e)

    def _run_once(self):
        t0 = time.monotonic()
        started_at = now_iso()
        result = {"startedAt": started_at, "error": None, "total": 0, "sent": 0, "skipped": 0, "failed": 0,
                  "items": []}
        try:
            underpasses = spring.list_underpasses()
        except spring.SpringError as e:
            result["error"] = str(e)
            log.warning("침수 계산 실패 (Spring 켜져 있는지 확인): %s", e)
            return self._finish(result, t0)

        with ThreadPoolExecutor(max_workers=config.FLOOD_WORKERS) as pool:
            items = list(pool.map(self._collect, underpasses))

        ready = [it for it in items if it["status"] == "ready"]
        if ready:
            try:
                preds = self.predict([it["input"] for it in ready])
                for it, p in zip(ready, preds):
                    it["riskScore"] = p["riskScore"]
                    it["riskLevel"] = p["riskLevel"]
                    it["levelName"] = LEVEL_NAMES.get(p["riskLevel"])
            except Exception as e:
                log.exception("모델 계산 실패")
                for it in ready:
                    it.update(status="failed", reason="모델 계산 실패: %s" % e)
                ready = []

        # 미래 점수: 모든 지하차도의 미래 시점을 한 번에 계산 (지금 점수가 계산된 지하차도만)
        future = [it for it in ready if it.get("future")]
        if future:
            try:
                preds = self.predict([r for it in future for _, r in it["future"]])
                pos = 0
                for it in future:
                    it["futurePreds"] = preds[pos:pos + len(it["future"])]
                    pos += len(it["future"])
            except Exception as e:
                log.exception("미래 점수 계산 실패")
                for it in future:
                    it.update(forecastStatus="failed", forecastReason="모델 계산 실패: %s" % e)
                future = []

        predicted_at = now_iso()   # 전송하는 지금 시각 (미래 시각 금지)
        if ready:
            with ThreadPoolExecutor(max_workers=config.FLOOD_WORKERS) as pool:
                list(pool.map(lambda it: self._send(it, predicted_at), ready))
                list(pool.map(lambda it: self._send_forecast(it, predicted_at), future))

        for it in items:
            it.pop("input", None)
            it.pop("future", None)
            it.pop("futurePreds", None)
            if it.get("forecastStatus") == "failed":
                log.warning("지하차도 %s(%s) 미래 점수 실패: %s", it["underpassId"], it.get("name"), it.get("forecastReason"))
            if it["status"] == "failed":
                log.warning("지하차도 %s(%s) 실패: %s", it["underpassId"], it.get("name"), it.get("reason"))
            elif it["status"] == "skipped":
                log.info("지하차도 %s(%s) 건너뜀: %s", it["underpassId"], it.get("name"), it.get("reason"))
        result["items"] = items
        result["total"] = len(items)
        for key, st in (("sent", "sent"), ("skipped", "skipped"), ("failed", "failed")):
            result[key] = sum(1 for it in items if it["status"] == st)
        result["forecastSent"] = sum(1 for it in items if it.get("forecastStatus") == "sent")
        result["forecastFailed"] = sum(1 for it in items if it.get("forecastStatus") == "failed")
        return self._finish(result, t0)

    def _finish(self, result, t0):
        result["finishedAt"] = now_iso()
        result["durationSec"] = round(time.monotonic() - t0, 2)
        self.last_run = result
        if not result["error"]:
            log.info("침수 계산 완료: 전송 %d, 건너뜀 %d, 실패 %d, 미래 점수 전송 %d (%.1f초)",
                     result["sent"], result["skipped"], result["failed"], result.get("forecastSent", 0),
                     result["durationSec"])
        return result

    # ---------- 자동 반복 ----------
    def loop(self, stop):
        """stop(threading.Event) 이 켜질 때까지 FLOOD_INTERVAL_SEC 마다 한 바퀴씩. 서버 켜자마자 1회 실행."""
        log.info("침수 자동 계산 시작 (%d초마다)", config.FLOOD_INTERVAL_SEC)
        while not stop.is_set():
            t0 = time.monotonic()
            try:
                self.run_once()
            except Exception:   # 어떤 오류가 나도 반복은 멈추지 않아요
                log.exception("침수 계산 중 예상 못 한 오류 (다음 차례에 다시 시도)")
            wait = max(0.0, config.FLOOD_INTERVAL_SEC - (time.monotonic() - t0))
            self.next_run_at = _iso_after(wait)
            if stop.wait(wait):
                break
