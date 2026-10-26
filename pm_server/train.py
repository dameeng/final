# -*- coding: utf-8 -*-
r"""CCTV·배수펌프 모델 학습:  venv\Scripts\python.exe train.py [CCTV|PUMP]
   -> models\cctv_model.joblib · models\pump_model.joblib (종류를 주면 그 종류만)

수위센서·전광판은 팀원 모델(models/wl_model.joblib · vms_model.joblib)을 그대로 써서 여기서 학습하지 않아요.

방식 (팀원 수위계·전광판 모델과 같게, pdm/cctv.py · pdm/pump.py · pdm/diag.py)
  1) 기간을 학습 / 검증 / 시험으로 나눠요
  2) 학습 구간 특징으로 RobustScaler + IsolationForest (비지도: 고장 정답을 쓰지 않아요)
  3) 70점 알림 기준 = 검증 구간(깨끗한 정상)에서 헛알림 묶음이 예산 이하가 되는 가장 낮은 값, 눈금은 pdm_common.make_anchors
  4) 시험 구간에서 탐지율 · 선행 시간 · 헛알림을 재서 모델 파일(evaluation)에 같이 저장해요
"""
import json
import sys
import time

import joblib

from pdm import cctv, pump
from pdm.features import SPECS
from pdm.model import MODEL_FILES

TRAIN = {"CCTV": cctv, "PUMP": pump}


def main():
    types = [t.upper() for t in sys.argv[1:]] or list(TRAIN)
    bad = [t for t in types if t not in TRAIN]
    if bad:
        sys.exit("학습할 수 있는 종류: %s (수위센서·전광판은 팀원 모델을 그대로 써요)" % ", ".join(TRAIN))
    for etype in types:
        t0 = time.time()
        b, ev = TRAIN[etype].train()
        b["evaluation"] = ev
        print("[%s] 특징 %s | 연속 %d번 | 검증 구간 헛알림 %d건" % (
            etype, [f[1] for f in SPECS[etype]["features"]], b["n_consec"], b["valid_alerts"]))
        print("   시험 구간: %s" % json.dumps(ev, ensure_ascii=False))
        path = MODEL_FILES[etype]
        path.parent.mkdir(exist_ok=True)
        joblib.dump({"version": b["version"], "type": etype, "trainedAt": time.strftime("%Y-%m-%d %H:%M:%S"), "model": b}, path)
        print("   저장: %s (%.1f초)" % (path, time.time() - t0))


if __name__ == "__main__":
    main()
