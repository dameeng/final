# -*- coding: utf-8 -*-
"""Spring 백엔드와 주고받는 함수 모음.
Spring 응답은 항상 {"success": ..., "message": ..., "data": ...} 모양이라 data만 꺼내서 돌려줘요."""
import json
import threading

import requests

import config

_local = threading.local()   # 카메라 작업이 각자 스레드에서 돌아서, 스레드마다 연결을 따로 씀


def _session():
    if not hasattr(_local, "session"):
        _local.session = requests.Session()
        _local.session.headers["X-Internal-Api-Key"] = config.INTERNAL_API_KEY   # /api/internal/** 인증용
    return _local.session


class SpringError(Exception):
    pass


def _data(res):
    try:
        body = res.json()
    except ValueError:
        raise SpringError(f"{res.status_code} {res.url} JSON 아님: {res.text[:200]}")
    if res.status_code >= 400 or not body.get("success", False):
        raise SpringError(f"{res.status_code} {res.url} {body.get('message')}")
    return body.get("data")


def get(path, **params):
    return _data(_session().get(config.SPRING_URL + path, params=params, timeout=config.HTTP_TIMEOUT_SEC))


def post_json(path, payload):
    return _data(_session().post(config.SPRING_URL + path, json=payload, timeout=config.HTTP_TIMEOUT_SEC))


def send_plate_log(payload, jpg_bytes=None):
    """번호판 인식 결과 전송 (multipart).
    request 파트는 꼭 application/json 타입이어야 Spring @RequestPart 가 읽어요 (아니면 415 에러)"""
    files = {"request": (None, json.dumps(payload, ensure_ascii=False), "application/json")}
    if jpg_bytes:
        files["image"] = ("capture.jpg", jpg_bytes, "image/jpeg")
    return _data(_session().post(config.SPRING_URL + "/api/internal/plate-logs",
                                 files=files, timeout=config.HTTP_TIMEOUT_SEC))
