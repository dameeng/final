# -*- coding: utf-8 -*-
"""Spring 과 주고받는 함수 모음. 응답 {"success","message","data"} 에서 data 만 꺼내줘요."""
import requests
from requests.adapters import HTTPAdapter

import config


class SpringError(Exception):
    """Spring 호출 실패 (연결 실패, 4xx/5xx, success=false)"""

    def __init__(self, message, status=None):
        super().__init__(message)
        self.status = status


_session = requests.Session()
_session.headers.update({"X-Internal-Api-Key": config.INTERNAL_API_KEY})
_adapter = HTTPAdapter(pool_connections=config.FLOOD_WORKERS, pool_maxsize=config.FLOOD_WORKERS * 2)
_session.mount("http://", _adapter)
_session.mount("https://", _adapter)


def _call(method, path, **kwargs):
    url = config.SPRING_URL.rstrip("/") + path
    try:
        resp = _session.request(method, url, timeout=config.HTTP_TIMEOUT_SEC, **kwargs)
    except requests.RequestException as e:
        raise SpringError("Spring 연결 실패 (%s %s): %s" % (method, path, e)) from e

    try:
        body = resp.json()
    except ValueError:
        body = None

    if resp.status_code >= 400 or (isinstance(body, dict) and body.get("success") is False):
        msg = body.get("message") if isinstance(body, dict) else resp.text[:200]
        raise SpringError("%s %s -> HTTP %s: %s" % (method, path, resp.status_code, msg), status=resp.status_code)
    if not isinstance(body, dict):
        raise SpringError("%s %s -> 응답 형식이 달라요 (JSON 객체 아님)" % (method, path), status=resp.status_code)
    return body.get("data")


def health():
    """GET /api/internal/health (API 키 검사 포함)"""
    return _call("GET", "/api/internal/health")


def list_underpasses():
    """GET /api/underpasses?page=N&size=100 : 페이지를 넘기며 전체 지하차도 목록"""
    items = []
    page = 1
    while page <= 1000:   # 무한 반복 방지
        data = _call("GET", "/api/underpasses",
                     params={"page": page, "size": config.UNDERPASS_PAGE_SIZE})
        items.extend(data.get("items") or [])
        if page >= int(data.get("totalPages") or 0):
            break
        page += 1
    return items


def get_underpass(underpass_id):
    """GET /api/underpasses/{id} : 상세 (heightM, lengthM 사용)"""
    return _call("GET", "/api/underpasses/%s" % underpass_id)


def get_rainfall(underpass_id):
    """GET /api/internal/weather/underpasses/{id}/rainfall : 강수 6개"""
    return _call("GET", "/api/internal/weather/underpasses/%s/rainfall" % underpass_id)


def get_forecast(underpass_id):
    """GET /api/internal/weather/underpasses/{id}/forecast : 앞으로의 시간별 예보 (targetAt, rainfallMm ...)"""
    return _call("GET", "/api/internal/weather/underpasses/%s/forecast" % underpass_id) or []


def send_risk_score(payload):
    """POST /api/internal/risk-scores : 위험점수 전송 (201)"""
    return _call("POST", "/api/internal/risk-scores", json=payload)


def send_risk_forecast(payload):
    """POST /api/internal/risk-forecasts : 미래 위험점수 전송 (201). 같은 시점은 덮어쓰고 지난 시점은 Spring 이 지워요"""
    return _call("POST", "/api/internal/risk-forecasts", json=payload)
