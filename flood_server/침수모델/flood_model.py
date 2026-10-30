"""지하차도 침수 위험 모델: 위험단계(0/1/2) + 위험점수(0~100)

- '위험 이상인가' / '침수인가' 두 개의 랜덤포레스트 (단조 제약: 비가 늘면 점수가 절대 내려가지 않음)
- 지하차도 차이는 '강수량 / 그 지하차도 침수기준' 비율 변수로 반영
- 점수 = 50·P(위험 이상) + 50·P(침수) 를 화면용으로 재조정 → 위험 40점, 침수 70점부터
"""
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier

RAIN = ['강수량_mm', '직전1시간_mm', '최근3시간_누적_mm', '최근6시간_누적_mm',
        '최근12시간_누적_mm', '최근24시간_누적_mm']
INPUT_COLS = RAIN + ['높이_m', '길이_m']
RATIO = ['비율_1h', '비율_직전', '비율_3h', '비율_6h', '비율_12h', '비율_24h']
FEATURES = RATIO + RAIN

# 원점수 → 표시점수 재조정 기준 (train.py에서 실제 데이터 평가로 정한 값)
RAW_T1, RAW_T2 = 25.0, 55.0      # 원점수 위험/침수 경계 (55: 위험 이상 거의 확실 + 침수 확률 10% 이상)
SHOW_T1, SHOW_T2 = 40.0, 70.0    # 표시점수 위험/침수 경계


def strength(h, l):
    """튼튼함 점수 (지하차도목록 시트와 같은 공식): 0 약함 ~ 1 튼튼
    학습 범위(높이 3.5~5m, 길이 70~400m) 밖이면 0~1로 잘라서 이상한 값 방지"""
    t = 0.5 * (h - 3.5) / 1.5 + 0.5 * (400 - l) / 330
    return np.clip(t, 0, 1)


def make_features(d):
    d = pd.DataFrame(d)[INPUT_COLS].astype(float)
    t = strength(d.높이_m, d.길이_m)
    f1, f3, f6 = 30 + 25 * t, 40 + 40 * t, 60 + 50 * t
    d['비율_1h'] = d.강수량_mm / f1
    d['비율_직전'] = d.직전1시간_mm / f1
    d['비율_3h'] = d.최근3시간_누적_mm / f3
    d['비율_6h'] = d.최근6시간_누적_mm / f6
    d['비율_12h'] = d.최근12시간_누적_mm / f6
    d['비율_24h'] = d.최근24시간_누적_mm / f6
    return d[FEATURES]


def to_display(raw):
    """단조 증가 구간별 선형 변환: 0→0, RAW_T1→40, RAW_T2→70, 100→100"""
    return np.interp(raw, [0, RAW_T1, RAW_T2, 100], [0, SHOW_T1, SHOW_T2, 100])


def to_stage(score):
    return np.select([score >= SHOW_T2, score >= SHOW_T1], [2, 1], default=0)


class FloodRiskModel:
    def __init__(self, n_estimators=300, min_samples_leaf=5, random_state=0):
        self.params = dict(n_estimators=n_estimators, min_samples_leaf=min_samples_leaf, class_weight=None,
                           max_features=None, monotonic_cst=[1] * len(FEATURES), n_jobs=-1,
                           random_state=random_state)

    def fit(self, X, y):
        F, y = make_features(X), np.asarray(y)
        self.m_risk = RandomForestClassifier(**self.params).fit(F, (y >= 1).astype(int))
        self.m_flood = RandomForestClassifier(**self.params).fit(F, (y == 2).astype(int))
        return self

    def raw_score(self, X):
        F = make_features(X)
        p1 = self.m_risk.predict_proba(F)[:, 1]
        p2 = np.minimum(self.m_flood.predict_proba(F)[:, 1], p1)
        return 50 * p1 + 50 * p2

    def predict(self, X):
        """DataFrame(위험점수, 위험단계) 반환"""
        s = to_display(self.raw_score(X))
        return pd.DataFrame({'위험점수': s.round(1), '위험단계': to_stage(s)})
