# -*- coding: utf-8 -*-
"""Spring 내부 API 호출 (외부 라이브러리 없이 표준 라이브러리만 써요).

  GET  /api/internal/pm/equipments   장비 목록 (이름·종류·센서 주기·dataStartedAt·lastSensorAt·lastScoreAt)
  GET  /api/internal/pm/sensors      장비별 센서 데이터 (버킷별 count·sum·sumSq·min·max)
  POST /api/internal/pm-scores       점수 묶음 (최대 1000건, 여기서는 500건씩 나눠 보내요)
모든 호출에 X-Internal-Api-Key 헤더. 응답은 {"success", "message", "data"} 의 data 만 돌려줘요.
"""
import json
import urllib.error
import urllib.parse
import urllib.request

import pandas as pd

from .features import SPECS, TIME_COL

SCORE_BATCH = 500
EQUIP_BATCH = 50          # sensors API 가 한 번에 받는 장비 수 상한


class SpringError(RuntimeError):
    """Spring 호출 실패 (연결 불가·인증 실패·4xx/5xx)"""


class SpringClient:

    def __init__(self, base_url, api_key, timeout=60):
        self.base = base_url.rstrip("/")
        self.key = api_key
        self.timeout = timeout

    # ------------------------------------------------------------ 공통
    def _call(self, method, path, params=None, body=None):
        url = self.base + path
        if params:
            url += "?" + urllib.parse.urlencode(params)
        data = None if body is None else json.dumps(body, ensure_ascii=False).encode("utf-8")
        req = urllib.request.Request(url, data=data, method=method)
        req.add_header("X-Internal-Api-Key", self.key)
        req.add_header("Accept", "application/json")
        if data is not None:
            req.add_header("Content-Type", "application/json; charset=utf-8")
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as r:
                payload = json.loads(r.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            detail = e.read().decode("utf-8", "replace")[:300]
            raise SpringError("%s %s -> HTTP %s %s" % (method, path, e.code, detail)) from e
        except (urllib.error.URLError, OSError) as e:
            raise SpringError("%s %s -> 연결 실패: %s" % (method, path, e)) from e
        if not payload.get("success", False):
            raise SpringError("%s %s -> %s" % (method, path, payload.get("message")))
        return payload.get("data")

    # ------------------------------------------------------------ 장비
    def equipments(self):
        """[{equipId, name, type, underpassId, underpassName, sensorIntervalSec, dataStartedAt, lastSensorAt, lastScoreAt}]"""
        return self._call("GET", "/api/internal/pm/equipments") or []

    # ------------------------------------------------------------ 센서
    def sensors(self, equip_ids, start=None, end=None, bucket_sec=None, limit=50000):
        """장비들의 센서 버킷 (start 이상, end 미만). 잘리면 nextAfter 로 이어 받아요. -> {equipId: [bucket, ...]}"""
        out = {}
        ids = list(equip_ids)
        for i in range(0, len(ids), EQUIP_BATCH):
            chunk = ids[i:i + EQUIP_BATCH]
            after = None
            while True:
                params = {"equipIds": ",".join(str(x) for x in chunk), "limit": limit}
                if start is not None:
                    params["from"] = _iso(start)
                if end is not None:
                    params["to"] = _iso(end)
                if bucket_sec:
                    params["bucketSec"] = int(bucket_sec)
                if after is not None:
                    params["after"] = after
                data = self._call("GET", "/api/internal/pm/sensors", params)
                for s in data.get("series", []):
                    out.setdefault(s["equipId"], []).extend(s.get("buckets", []))
                if not data.get("truncated"):
                    break
                after = data.get("nextAfter")
                if not after:
                    break
        return out

    # ------------------------------------------------------------ 점수
    def post_scores(self, scores, backfill=False):
        """점수 목록을 500건씩 나눠 보내요. -> 응답 data 목록"""
        results = []
        for i in range(0, len(scores), SCORE_BATCH):
            results.append(self._call("POST", "/api/internal/pm-scores",
                                      body={"backfill": bool(backfill), "scores": scores[i:i + SCORE_BATCH]}))
        return results


def _iso(t):
    return pd.Timestamp(t).strftime("%Y-%m-%dT%H:%M:%S")


def buckets_to_frame(etype, buckets):
    """원본 주기로 받은 버킷 -> 모델 입력 표 (시각 열 + 센서 열). 값 = sum / count, 값이 비면(count 0) None"""
    cols = list(SPECS[etype]["metrics"])
    rows = []
    for b in buckets:
        row = {TIME_COL[etype]: b["t"]}
        cs = b.get("cols", {})
        for c in cols:
            v = cs.get(c)
            row[c] = (v["sum"] / v["count"]) if v and v.get("count") else None
        rows.append(row)
    df = pd.DataFrame(rows, columns=[TIME_COL[etype]] + cols)
    df[TIME_COL[etype]] = pd.to_datetime(df[TIME_COL[etype]])
    for c in cols:
        df[c] = pd.to_numeric(df[c], errors="coerce")
    return df.sort_values(TIME_COL[etype]).reset_index(drop=True)
