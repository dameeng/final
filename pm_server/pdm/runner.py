# -*- coding: utf-8 -*-
"""Spring 과 주고받는 반복 작업 (조회 -> 계산 -> 점수 보내기).

  cycle()     한 바퀴: 장비 목록 -> (새 센서가 있는 장비만) 센서 조회 -> 점수 계산 -> POST /api/internal/pm-scores
  backfill()  서버를 켤 때 한 번: 지난 N일(기본 7일)을 step 간격(기본 1시간)으로 계산해 backfill=true 로 보내요.
              Spring 은 이 점수를 저장만 하고 이벤트·알림은 만들지 않아요.
              마지막 시점(= 가장 최근 센서 시각)은 일부러 빼요 -> 이어지는 cycle() 이 보내야 위험진입·급상승 판단이 돼요.

센서 창은 '각 장비의 마지막 센서 시각(lastSensorAt)' 기준으로 잘라요. 지금 시각이 아니라서 센서가 멈춰 있어도(시연 전 백필만 있는 상태) 계산돼요.
센서가 오래 끊겼는지(미수신) 판단은 Spring 이 해요. 이 서버는 점수를 못 만드는 장비(데이터 부족·평소 값 없음)를 건너뛰고 사유만 status 에 남겨요.
"""
import logging
import re
import threading
import time
from datetime import datetime, timedelta

import pandas as pd

from .features import TIME_COL
from .spring_client import SpringError, buckets_to_frame

log = logging.getLogger("pdm.runner")

# 점수 하나를 만들 때 가져올 과거 구간. 모델 최소 창보다 넉넉하게 (수위 3일 = 팀원 권장, 전광판 72시간 = 팀원 권장)
LOOKBACK = {"PUMP": timedelta(minutes=12), "CCTV": timedelta(hours=24),
            "WATER_LEVEL": timedelta(days=3), "DISPLAY": timedelta(hours=72)}
PATH = {"CCTV": "cctv", "PUMP": "pump", "WATER_LEVEL": "waterlevel", "DISPLAY": "vms"}
CAUTION = 40.0                 # 이 점수 이상이 이어진 시작 시각 = anomalyStartedAt (Spring 기본 주의 임계치와 같음)
BASELINE_DAYS = 38             # 전광판 평소 값 = (t0-37일, t0-7일] 이라 38일치를 받아요


def _short(text):
    """사유 문장에서 '(평소 … → 지금 …)' 꼬리를 떼어 알림에 쓰기 좋게"""
    return re.sub(r"\s*\([^)]*→[^)]*\)\s*$", "", text or "").strip()


class Runner:

    def __init__(self, models, client, poll_sec=10, backfill_days=7, backfill_step_min=60):
        self.models, self.client = models, client
        self.poll_sec, self.backfill_days, self.backfill_step_min = poll_sec, backfill_days, backfill_step_min
        self.lock = threading.Lock()
        self.stop_flag = threading.Event()
        self.buffers = {}          # equipId -> 센서 표 (최근 창만)
        self.baselines = {}        # (equipId, 날짜) -> 전광판 평소 값 (없으면 None)
        self.started = {}          # equipId -> 이상(주의 이상)이 시작된 시각 (정상이면 None)
        self.pending = {}         # equipId -> 전송 대기 중인 최신 점수 (실패하면 다음 cycle에서 재시도)
        self.last_post_at = None   # 새 데이터가 없어도 60초마다 1건으로 엔진 생존 신호
        self.latest = {}           # equipId -> {sensorAt, item, status}
        self.info = {"startedAt": datetime.now().isoformat(timespec="seconds"), "cycles": 0, "lastCycleAt": None,
                     "lastError": None, "sent": 0, "backfill": {"state": "idle"}}

    # ------------------------------------------------------------------ 점수 하나
    def _anomaly_start(self, equip_id, at, score):
        if score >= CAUTION:
            if self.started.get(equip_id) is None:
                self.started[equip_id] = at
        else:
            self.started[equip_id] = None
        s = self.started.get(equip_id)
        return None if s is None else pd.Timestamp(s).strftime("%Y-%m-%dT%H:%M:%S")

    def _item(self, etype, eq, df, at, baseline=None, track=True):
        """진단 -> Spring 점수 1건. 점수를 못 만들면 (None, status)"""
        r = self.models.diagnose(etype, eq["equipId"], df, baseline=baseline, now=at)
        if r.get("status") != "ok" or r.get("risk_score") is None:
            return None, r.get("status") or "error"
        score = float(r["risk_score"])
        started = self._anomaly_start(eq["equipId"], at, score) if track else None
        extra = {k: r[k] for k in ("sensors",) if r.get(k)}
        if r.get("suspected_cause"):
            extra["suspectedCause"] = r["suspected_cause"]
        if r.get("anomaly_type"):
            extra["anomalyType"] = r["anomaly_type"]
        if r.get("reasons"):
            extra["reasonDetails"] = r["reasons"]
        return {
            "equipId": eq["equipId"], "type": etype, "score": round(score, 2),
            "predictedAt": pd.Timestamp(at).strftime("%Y-%m-%dT%H:%M:%S"),
            "reasons": [_short(x["설명"]) for x in r.get("reasons", [])][:3],
            "detail": {"features": r.get("features", []), "anomalyStartedAt": started, "extra": extra},
            "modelVersion": str((self.models.meta.get(etype) or {}).get("version") or etype)[:30],
        }, "ok"

    # ------------------------------------------------------------------ 전광판 평소 값
    def _baseline(self, eq, at):
        """그날 0시 기준 평소 값 (하루 한 번 만들어 캐시). 이력이 모자라면 None"""
        day = pd.Timestamp(at).normalize()
        key = (eq["equipId"], day)
        if key in self.baselines:
            return self.baselines[key]
        # 같은 날짜가 아닌 오래된 캐시는 버려요
        for k in [k for k in self.baselines if k[0] == eq["equipId"] and k[1] < day - pd.Timedelta(days=10)]:
            del self.baselines[k]
        got = self.client.sensors([eq["equipId"]], start=day - pd.Timedelta(days=BASELINE_DAYS), end=day)
        base = None
        if got.get(eq["equipId"]):
            df = buckets_to_frame("DISPLAY", got[eq["equipId"]])
            base = self.models.build_baseline(df, now=day)
        self.baselines[key] = base
        return base

    def _baselines_for(self, eqs, ats):
        """전광판 여러 대의 평소 값을 한 번에 (캐시에 없는 것만 묶어서 조회)"""
        need = {}
        for eq in eqs:
            day = pd.Timestamp(ats[eq["equipId"]]).normalize()
            if (eq["equipId"], day) not in self.baselines:
                need.setdefault(day, []).append(eq)
        for day, group in need.items():
            got = self.client.sensors([e["equipId"] for e in group], start=day - pd.Timedelta(days=BASELINE_DAYS), end=day)
            for e in group:
                b = None
                if got.get(e["equipId"]):
                    b = self.models.build_baseline(buckets_to_frame("DISPLAY", got[e["equipId"]]), now=day)
                self.baselines[(e["equipId"], day)] = b

    # ------------------------------------------------------------------ 한 바퀴
    def _refresh_buffers(self, etype, eqs):
        """새 센서가 있는 장비만 조회해서 버퍼를 갱신 (처음이거나 시간이 거꾸로 가면 전체 창)"""
        tc = TIME_COL[etype]
        look = LOOKBACK[etype]
        full, inc = [], []
        for eq in eqs:
            last = pd.Timestamp(eq["lastSensorAt"])
            buf = self.buffers.get(eq["equipId"])
            if buf is None or buf.empty or buf[tc].max() > last or buf[tc].max() < last - look:
                full.append(eq)
            elif buf[tc].max() < last:
                inc.append(eq)
        for group, mode in ((full, "full"), (inc, "inc")):
            if not group:
                continue
            by_last = {}
            for eq in group:                                  # 마지막 시각이 같은 장비끼리 묶어서 한 번에 조회
                by_last.setdefault(eq["lastSensorAt"], []).append(eq)
            for last_s, g in by_last.items():
                last = pd.Timestamp(last_s)
                end = last + pd.Timedelta(seconds=1)
                if mode == "full":
                    got = self.client.sensors([e["equipId"] for e in g], start=last - look, end=end)
                else:
                    after = min(self.buffers[e["equipId"]][tc].max() for e in g)
                    got = self.client.sensors([e["equipId"] for e in g], end=end, start=after + pd.Timedelta(seconds=1))
                for e in g:
                    df = buckets_to_frame(etype, got.get(e["equipId"], []))
                    if mode == "inc":
                        df = pd.concat([self.buffers[e["equipId"]], df]).drop_duplicates(tc)
                    self.buffers[e["equipId"]] = df[df[tc] >= last - look].reset_index(drop=True)

    def cycle(self):
        """한 바퀴. 보낸 점수 수를 돌려줘요"""
        with self.lock:
            t0 = time.time()
            self.info["lastBatch"] = 0
            statuses = {}
            try:
                eqs = [e for e in self.client.equipments() if e.get("lastSensorAt")]
                active_ids = {e["equipId"] for e in eqs}
                for cache in (self.latest, self.pending, self.buffers, self.started):
                    for eid in list(cache):
                        if eid not in active_ids:
                            del cache[eid]
                by_type = {}
                for e in eqs:
                    by_type.setdefault(e["type"], []).append(e)
                for etype, group in by_type.items():
                    if not self.models.has(etype):
                        continue
                    changed = [e for e in group
                               if self.latest.get(e["equipId"], {}).get("sensorAt") != e["lastSensorAt"]]
                    if changed:
                        self._refresh_buffers(etype, changed)
                    ats = {e["equipId"]: pd.Timestamp(e["lastSensorAt"]) for e in changed}
                    if etype == "DISPLAY" and changed:
                        self._baselines_for(changed, ats)
                    for e in changed:
                        buf = self.buffers.get(e["equipId"])
                        if buf is None or buf.empty:
                            statuses[e["equipId"]] = "no_data"
                            self.pending.pop(e["equipId"], None)
                            self.latest.pop(e["equipId"], None)
                            continue
                        base = self.baselines.get((e["equipId"], ats[e["equipId"]].normalize())) if etype == "DISPLAY" else None
                        item, st = self._item(etype, e, buf, ats[e["equipId"]], baseline=base)
                        statuses[e["equipId"]] = st
                        if item:
                            self.pending[e["equipId"]] = item
                        else:
                            self.pending.pop(e["equipId"], None)
                        self.latest[e["equipId"]] = {"sensorAt": e["lastSensorAt"], "item": item, "status": st}
                    for e in group:
                        if e not in changed:
                            statuses[e["equipId"]] = self.latest.get(e["equipId"], {}).get("status", "no_data")
                batch = list(self.pending.values())
                # Spring 엔진 상태는 수신 시각으로 판단하므로, 느린 주기의 설비만 있어도
                # DOWN으로 오인하지 않도록 60초마다 캐시 1건을 heartbeat로 보낸다.
                # 같은 equipId + predictedAt은 Spring이 중복 저장 없이 건너뛴다.
                heartbeat = False
                if not batch and (self.last_post_at is None or time.monotonic() - self.last_post_at >= 60):
                    cached = [v["item"] for v in self.latest.values() if v.get("item")]
                    batch = cached[:1]
                    heartbeat = bool(batch)
                if batch:
                    self.client.post_scores(batch, backfill=False)
                    self.info["sent"] += len(batch)
                    self.pending.clear()
                    self.last_post_at = time.monotonic()
                self.info.update(lastError=None, lastStatuses=statuses, lastBatch=len(batch), heartbeat=heartbeat)
            except SpringError as e:
                self.info["lastError"] = str(e)
                log.warning("Spring 연동 실패: %s", e)
            except Exception as e:                           # 한 바퀴 실패가 반복 작업을 멈추지 않게
                self.info["lastError"] = "%s: %s" % (type(e).__name__, e)
                log.exception("cycle 실패")
            self.info.update(cycles=self.info["cycles"] + 1, lastCycleAt=datetime.now().isoformat(timespec="seconds"),
                             lastCycleSec=round(time.time() - t0, 2))
            return self.info.get("lastBatch", 0)

    # ------------------------------------------------------------------ 지난 N일 채우기
    def backfill(self, force=False):
        """점수 없는 장비만 자동 백필. force=True는 수동 재계산 (기존 점수는 덮어쓰지 않음)."""
        with self.lock:
            bf = self.info["backfill"] = {"state": "running", "startedAt": datetime.now().isoformat(timespec="seconds"),
                                          "computed": 0, "skipped": {}, "sent": 0, "force": force, "skippedExisting": 0}
            t0 = time.time()
            try:
                eqs = [e for e in self.client.equipments() if e.get("lastSensorAt")]
                if not force:
                    # 장비별 점수가 이미 하나라도 있으면 시작 시 대량 재계산을 생략한다.
                    # 불완전한 이력을 다시 채우려면 수동 /link/backfill을 사용한다.
                    bf["skippedExisting"] = sum(bool(e.get("lastScoreAt")) for e in eqs)
                    eqs = [e for e in eqs if not e.get("lastScoreAt")]
                step = pd.Timedelta(minutes=self.backfill_step_min)
                n_marks = int(pd.Timedelta(days=self.backfill_days) / step)
                items = []
                for etype in ("CCTV", "WATER_LEVEL", "DISPLAY", "PUMP"):
                    if not self.models.has(etype):
                        continue
                    by_last = {}
                    for e in eqs:
                        if e["type"] == etype:
                            by_last.setdefault(e["lastSensorAt"], []).append(e)
                    for last_s, group in by_last.items():
                        last = pd.Timestamp(last_s)
                        marks = [last - step * k for k in range(n_marks, 0, -1)]      # 오래된 것부터 (마지막 시점은 제외)
                        if etype == "PUMP":
                            self._backfill_pump(group, marks, items, bf)
                        else:
                            self._backfill_series(etype, group, last, marks, items, bf)
                if items:
                    self.client.post_scores(items, backfill=True)
                bf.update(state="done", sent=len(items), seconds=round(time.time() - t0, 1))
                log.info("백필 완료: 점수 %d건 (%.0f초) 건너뜀 %s", len(items), time.time() - t0, bf["skipped"])
            except Exception as e:
                bf.update(state="error", error="%s: %s" % (type(e).__name__, e))
                log.exception("백필 실패")

    def _skip(self, bf, status):
        bf["skipped"][status] = bf["skipped"].get(status, 0) + 1

    def _backfill_pump(self, group, marks, items, bf):
        """펌프는 10초 데이터라 점수 시점마다 짧은 창만 조회 (전체를 받으면 장비당 6만 행)"""
        look = LOOKBACK["PUMP"]
        ids = [e["equipId"] for e in group]
        for mark in marks:
            got = self.client.sensors(ids, start=mark - look, end=mark + pd.Timedelta(seconds=1))
            for e in group:
                bs = got.get(e["equipId"])
                if not bs:
                    self._skip(bf, "no_data")
                    continue
                item, st = self._item("PUMP", e, buckets_to_frame("PUMP", bs), mark)
                bf["computed"] += 1
                if item:
                    items.append(item)
                else:
                    self._skip(bf, st)

    def _backfill_series(self, etype, group, last, marks, items, bf):
        tc, look = TIME_COL[etype], LOOKBACK[etype]
        ids = [e["equipId"] for e in group]
        start = marks[0] - look
        got = self.client.sensors(ids, start=start, end=last + pd.Timedelta(seconds=1))
        frames = {e["equipId"]: buckets_to_frame(etype, got.get(e["equipId"], [])) for e in group}
        if etype == "DISPLAY":
            for day in sorted({m.normalize() for m in marks}):                  # 날짜별 평소 값을 미리 만들어 둬요
                self._baselines_for(group, {e["equipId"]: day for e in group})
        for mark in marks:
            for e in group:
                df = frames[e["equipId"]]
                w = df[(df[tc] <= mark) & (df[tc] > mark - look)]
                if w.empty:
                    self._skip(bf, "no_data")
                    continue
                base = self.baselines.get((e["equipId"], mark.normalize())) if etype == "DISPLAY" else None
                item, st = self._item(etype, e, w, mark, baseline=base)
                bf["computed"] += 1
                if item:
                    items.append(item)
                else:
                    self._skip(bf, st)

    # ------------------------------------------------------------------ 반복
    def reset(self):
        with self.lock:
            self.buffers.clear()
            self.latest.clear()
            self.pending.clear()
            self.last_post_at = None
            self.started.clear()
            self.baselines.clear()

    def loop(self, do_backfill=True):
        """백그라운드 스레드: (백필) -> 주기마다 cycle. Spring 이 아직 안 떠 있으면 연결될 때까지 기다려요"""
        if do_backfill:
            while not self.stop_flag.is_set():
                try:
                    self.client.equipments()
                    break
                except SpringError as e:
                    self.info["lastError"] = str(e)
                    log.warning("Spring 이 아직 안 떴어요: %s (10초 뒤 다시)", e)
                    self.stop_flag.wait(10)
            if not self.stop_flag.is_set():
                self.backfill()
        while not self.stop_flag.is_set():
            self.cycle()
            self.stop_flag.wait(self.poll_sec)
