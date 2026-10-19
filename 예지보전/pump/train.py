"""
Leave-One-Failure-Out 교차검증(고장 7건 → 7 fold) 후 전체 데이터로 최종 모델 학습.
fold k: k번째 고장으로 끝나는 운전 구간을 테스트, 나머지 구간으로 학습.
"""
import json

import joblib
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.metrics import average_precision_score, mean_absolute_error, roc_auc_score

from pump_config import ALARM_QUANTILE, ALARM_WINDOW_H, DATA_DIR, HORIZON_H, MODEL_DIR, OUT_DIR, RUL_CAP_H, WARN_QUANTILE
from features import anomaly_input, build_features, build_labels
from models import AnomalyDetector, classifier_sensor_contrib, make_classifier, make_regressor


def fit_all(feats, lab, train):
    healthy = train & lab.normal & ~(lab.ttf_h <= ALARM_WINDOW_H)
    det = AnomalyDetector().fit(anomaly_input(feats[healthy]))

    tr_c = train & lab.normal & lab.y_cls.notna()
    clf = make_classifier(lab.y_cls[tr_c]).fit(feats[tr_c], lab.y_cls[tr_c].astype(int))

    tr_r = train & lab.normal & lab.y_rul.notna()
    reg = make_regressor().fit(feats[tr_r], lab.y_rul[tr_r])
    return det, clf, reg


def lead_time_h(score, ttf, thr):
    """고장 전 ALARM_WINDOW_H 이내에서 처음 경보가 울린 시점 (고장 몇 시간 전). 없으면 0."""
    hit = (ttf <= ALARM_WINDOW_H) & (score >= thr)
    return float(ttf[hit].max()) if hit.any() else 0.0


def false_alarm_rate(score, ttf, thr):
    """고장과 무관한 구간(고장 ALARM_WINDOW_H 이전)에서 경보 상태였던 시간 비율."""
    healthy = ~(ttf <= ALARM_WINDOW_H)
    return float((score[healthy] >= thr).mean())


def safe_auc(fn, y, s):
    return float(fn(y, s)) if len(np.unique(y)) == 2 else np.nan


def healthy_quantile(score, ttf, q):
    return float(score[~(ttf <= ALARM_WINDOW_H)].quantile(q))


def fold_metrics(k, failure, lab, pred, thr):
    y, ttf = lab.y_cls, lab.ttf_h
    a, p, r = pred.anomaly_score, pred.fail_prob, pred.rul_pred
    near = lab.y_rul < RUL_CAP_H
    return {
        "fold": k,
        "failure_at": str(failure),
        "anomaly_roc_auc": safe_auc(roc_auc_score, y, a),
        "anomaly_lead_h": lead_time_h(a, ttf, thr["anomaly"]),
        "anomaly_false_alarm": false_alarm_rate(a, ttf, thr["anomaly"]),
        "clf_pr_auc": safe_auc(average_precision_score, y, p),
        "clf_roc_auc": safe_auc(roc_auc_score, y, p),
        "clf_lead_h": lead_time_h(p, ttf, thr["prob"]),
        "clf_false_alarm": false_alarm_rate(p, ttf, thr["prob"]),
        "rul_mae_h": float(mean_absolute_error(lab.y_rul, r)),
        f"rul_mae_h_last{RUL_CAP_H}h": float(mean_absolute_error(lab.y_rul[near], r[near])) if near.any() else np.nan,
    }


def plot_timeline(data, lab, oof, failures, thr, path):
    fig, ax = plt.subplots(3, 1, figsize=(16, 9), sharex=True)
    ax[0].plot(oof.index, oof.anomaly_score, lw=0.6)
    ax[0].axhline(thr["anomaly"], color="gray", ls="--", lw=0.8)
    ax[0].set_ylabel("① anomaly score")
    ax[1].plot(oof.index, oof.fail_prob, lw=0.6, color="tab:orange")
    ax[1].axhline(thr["prob"], color="gray", ls="--", lw=0.8)
    ax[1].set_ylabel(f"② P(fail ≤{HORIZON_H}h)")
    ax[2].plot(lab.index, lab.y_rul.where(lab.normal), lw=1, color="black", label="true (capped)")
    ax[2].plot(oof.index, oof.rul_pred, lw=0.6, color="tab:green", label="predicted")
    ax[2].set_ylabel("③ RUL (h)")
    ax[2].legend(loc="upper right")
    for a in ax:
        for f in failures:
            a.axvline(f, color="red", lw=1)
        a.fill_between(data.index, 0, 1, where=data.status > 0, transform=a.get_xaxis_transform(),
                       color="red", alpha=0.08, lw=0)
    ax[0].set_title("Out-of-fold predictions (red line = failure, shaded = BROKEN/RECOVERING)")
    fig.tight_layout()
    fig.savefig(path, dpi=130)
    plt.close(fig)


def plot_failure_zoom(oof, failures, thr, path, hours=72):
    """경보 임계값 대비 비율(1 이상 = 경보)로 정규화해 두 점수를 같은 축에 표시."""
    fig, axes = plt.subplots(1, len(failures), figsize=(3.2 * len(failures), 3), sharey=True)
    for a, f in zip(axes, failures):
        w = oof.loc[f - pd.Timedelta(hours=hours): f]
        h = (w.index - f).total_seconds() / 3600
        a.plot(h, w.anomaly_score / thr["anomaly"], label="① anomaly / thr", lw=1)
        a.plot(h, w.fail_prob / thr["prob"], label="② P(fail) / thr", lw=1)
        a.axhline(1, color="red", ls="--", lw=0.8)
        a.axvline(-HORIZON_H, color="gray", ls=":", lw=0.8)
        a.set_title(f.strftime("%m-%d %H:%M"), fontsize=9)
        a.set_xlabel("hours to failure")
    axes[0].legend(fontsize=7)
    fig.tight_layout()
    fig.savefig(path, dpi=130)
    plt.close(fig)


def plot_sensor_importance(contrib, path, top=15):
    imp = contrib.abs().mean().sort_values().tail(top)
    fig, ax = plt.subplots(figsize=(6, 5))
    imp.plot.barh(ax=ax)
    ax.set_title("④ Sensor importance (mean |SHAP|, early-warning model)")
    fig.tight_layout()
    fig.savefig(path, dpi=130)
    plt.close(fig)


def main():
    bundle = pd.read_pickle(DATA_DIR / "pump_10min.pkl")
    data, sensors, failures = bundle["data"], bundle["sensors"], bundle["failures"]
    feats = build_features(data, sensors)
    lab = build_labels(data, failures)
    OUT_DIR.mkdir(exist_ok=True)
    MODEL_DIR.mkdir(exist_ok=True)

    oof = pd.DataFrame(np.nan, index=data.index, columns=["anomaly_score", "fail_prob", "rul_pred"])
    for k, failure in enumerate(failures):
        test = (lab.cycle == k).to_numpy()
        det, clf, reg = fit_all(feats, lab, ~test)

        te = test & lab.normal.to_numpy()
        oof.loc[te, "anomaly_score"] = det.score(anomaly_input(feats[te])).to_numpy()
        oof.loc[te, "fail_prob"] = clf.predict_proba(feats[te])[:, 1]
        oof.loc[te, "rul_pred"] = np.clip(reg.predict(feats[te]), 0, RUL_CAP_H)

        print(f"fold {k} ({failure:%m-%d}) done")

    pred = oof.fail_prob.notna()
    thr = {name: healthy_quantile(oof.loc[pred, col], lab.ttf_h[pred], q)
           for name, col, q in [("anomaly", "anomaly_score", ALARM_QUANTILE), ("prob", "fail_prob", ALARM_QUANTILE),
                                ("anomaly_warn", "anomaly_score", WARN_QUANTILE), ("prob_warn", "fail_prob", WARN_QUANTILE)]}
    ev = pred & lab.y_cls.notna() & lab.y_rul.notna()
    rows = [fold_metrics(k, f, lab[ev & (lab.cycle == k)], oof[ev & (lab.cycle == k)], thr)
            for k, f in enumerate(failures)]
    folds = pd.DataFrame(rows)
    ev = oof.fail_prob.notna() & lab.y_cls.notna()
    overall = {
        "anomaly_roc_auc": safe_auc(roc_auc_score, lab.y_cls[ev], oof.anomaly_score[ev]),
        "clf_pr_auc": safe_auc(average_precision_score, lab.y_cls[ev], oof.fail_prob[ev]),
        "clf_roc_auc": safe_auc(roc_auc_score, lab.y_cls[ev], oof.fail_prob[ev]),
        "positive_rate": float(lab.y_cls[ev].mean()),
        "failures_detected_anomaly": int((folds.anomaly_lead_h > 0).sum()),
        "failures_detected_clf": int((folds.clf_lead_h > 0).sum()),
        "n_failures": len(failures),
        "mean_lead_h_clf": float(folds.clf_lead_h.mean()),
        "rul_mae_h": float(folds.rul_mae_h.mean()),
        "thresholds": thr,
    }

    folds.to_csv(OUT_DIR / "cv_folds.csv", index=False)
    pd.concat([lab, oof], axis=1).to_csv(OUT_DIR / "oof_predictions.csv")
    with open(OUT_DIR / "metrics.json", "w", encoding="utf-8") as fp:
        json.dump({"overall": overall, "folds": rows}, fp, indent=2, ensure_ascii=False)
    plot_timeline(data, lab, oof, failures, thr, OUT_DIR / "cv_timeline.png")
    plot_failure_zoom(oof, failures, thr, OUT_DIR / "cv_failure_zoom.png")

    # 최종 모델: 전체 데이터 학습
    det, clf, reg = fit_all(feats, lab, np.ones(len(data), bool))
    normal = lab.normal.to_numpy()
    plot_sensor_importance(classifier_sensor_contrib(clf, feats[normal]), OUT_DIR / "sensor_importance.png")
    joblib.dump(
        {"detector": det, "classifier": clf, "regressor": reg, "sensors": sensors,
         "features": list(feats.columns), "thresholds": thr},
        MODEL_DIR / "pump_models.joblib",
    )

    pd.set_option("display.width", 200)
    print(folds.round(3).to_string(index=False))
    print(json.dumps(overall, indent=2))


if __name__ == "__main__":
    main()
