# -*- coding: utf-8 -*-
"""수위계·전광판 공용: 0~100 점수 변환, 등급, 연속 조건."""
import numpy as np

LEVEL_WARN, LEVEL_DANGER = 40, 70          # Spring pm_threshold 와 같은 기준 (정상 <40 / 주의 40~69 / 위험 70+)


def level_of(score):
    if score is None or not np.isfinite(score):
        return None
    return "위험" if score >= LEVEL_DANGER else ("주의" if score >= LEVEL_WARN else "정상")


def make_anchors(valid_scores, thr_alert):
    """검증(정상) 구간 이상 점수로 눈금 기준점을 만든다.

    p01 -> 0점, p50 -> 20점, 40점 = min(p99, p50+0.65*(thr_alert-p50)), thr_alert -> 70점, thr_alert + (thr_alert - p50) -> 100점
    thr_alert: 검증 구간에서 '헛알림 묶음이 예산 이하'가 되는 가장 낮은 임계값 (실험에서 쓴 알림 기준)
    """
    v = np.asarray(valid_scores, dtype=float)
    v = v[np.isfinite(v)]
    p01, p50, p99 = (float(np.quantile(v, q)) for q in (0.01, 0.50, 0.99))
    thr = float(thr_alert)
    x40 = min(p99, p50 + 0.65 * (thr - p50))          # 40점: 정상 1% 지점, 단 70점 기준과 너무 붙으면 안 되므로 위쪽 제한
    xs = [p01, p50, x40, thr, thr + (thr - p50)]
    for i in range(1, len(xs)):                       # 순서가 겹치지 않게 아주 조금 벌린다
        if xs[i] <= xs[i - 1]:
            xs[i] = xs[i - 1] + 1e-6 * max(1.0, abs(xs[i - 1]))
    return dict(x=xs, y=[0.0, 20.0, 40.0, 70.0, 100.0],
                p01=p01, p50=p50, p99=p99, thr_alert=thr)


def to_risk(raw, anchors):
    """이상 점수(raw) -> 0~100 위험 점수 (구간별 직선, 양 끝은 0/100에서 자름)"""
    return np.interp(np.asarray(raw, dtype=float), anchors["x"], anchors["y"], left=0.0, right=100.0)


def sustained(risk_series, n):
    """마지막 n개 점수의 최솟값 = n번 연속으로 그 점수 이상일 때만 높게 나오는 값 (실험의 '연속 n번 넘으면 알림' 규칙)"""
    r = np.asarray(risk_series, dtype=float)
    if len(r) < n or not np.isfinite(r[-n:]).all():
        return np.nan
    return float(r[-n:].min())
