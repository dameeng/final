"""① 이상탐지 / ② 조기경보 / ③ RUL / ④ 원인 센서 분석"""
import numpy as np
import pandas as pd
from lightgbm import LGBMClassifier, LGBMRegressor
from sklearn.decomposition import PCA
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

from pump_config import SEED, STEPS_PER_HOUR
from features import sensor_of


class AnomalyDetector:
    """
    ① 정상 구간의 '기준선 대비 편차' 패턴만 학습.
    PCA 재구성오차 + IsolationForest 점수를 학습 분포 대비 백분위(0~1)로 변환해 평균.
    """

    def __init__(self, pca_var=0.95):
        self.pca_var = pca_var

    def fit(self, X):
        self.columns = list(X.columns)
        self.scaler = StandardScaler().fit(X)
        Z = self.scaler.transform(X)
        self.pca = PCA(n_components=self.pca_var, random_state=SEED).fit(Z)
        self.iforest = IsolationForest(n_estimators=200, random_state=SEED, n_jobs=-1).fit(Z)
        pca_s, if_s = self._raw_scores(Z)
        self.ref_pca, self.ref_if = np.sort(pca_s), np.sort(if_s)
        return self

    def _recon_err(self, Z):
        return (Z - self.pca.inverse_transform(self.pca.transform(Z))) ** 2

    def _raw_scores(self, Z):
        return self._recon_err(Z).sum(axis=1), -self.iforest.score_samples(Z)

    def score(self, X):
        """시간순 입력 가정. 1시간 이동평균으로 순간 노이즈 완화."""
        pca_s, if_s = self._raw_scores(self.scaler.transform(X[self.columns]))
        p1 = np.searchsorted(self.ref_pca, pca_s, side="right") / len(self.ref_pca)
        p2 = np.searchsorted(self.ref_if, if_s, side="right") / len(self.ref_if)
        raw = pd.Series((p1 + p2) / 2, index=X.index)
        return raw.rolling(STEPS_PER_HOUR, min_periods=1).mean()

    def sensor_contrib(self, X):
        """④ 센서별 재구성 오차 — 정상 패턴에서 가장 벗어난 센서."""
        err = self._recon_err(self.scaler.transform(X[self.columns]))
        return pd.DataFrame(err, index=X.index, columns=[sensor_of(c) for c in self.columns])


_LGBM_PARAMS = dict(
    n_estimators=400,
    learning_rate=0.03,
    num_leaves=15,
    min_child_samples=100,
    subsample=0.8,
    subsample_freq=1,
    colsample_bytree=0.5,
    reg_lambda=1.0,
    random_state=SEED,
    verbose=-1,
)


def make_classifier(y):
    """② 고장 비율이 낮아 양성 가중치 부여."""
    pos = float(np.mean(y))
    return LGBMClassifier(scale_pos_weight=(1 - pos) / pos, **_LGBM_PARAMS)


def make_regressor():
    """③ 이상치에 덜 민감한 MAE 손실."""
    return LGBMRegressor(objective="l1", **_LGBM_PARAMS)


def classifier_sensor_contrib(clf, X):
    """④ LightGBM 내장 SHAP 값(pred_contrib)을 센서 단위로 합산. 양수 = 고장 확률을 올린 방향."""
    contrib = clf.predict(X, pred_contrib=True)[:, :-1]
    df = pd.DataFrame(contrib, index=X.index, columns=X.columns)
    return df.T.groupby(sensor_of).sum().T


def top_sensors(contrib, k=3):
    names = contrib.columns.to_numpy()
    idx = np.argsort(-contrib.to_numpy(), axis=1)[:, :k]
    return pd.Series([",".join(row) for row in names[idx]], index=contrib.index)
