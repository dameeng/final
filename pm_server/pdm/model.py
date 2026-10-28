# -*- coding: utf-8 -*-
"""모델 4개를 불러서 진단해요. 서버(main.py)는 이 Models 만 써요.

| 종류        | 모델                                        | 진단 함수                        |
| CCTV        | models/cctv_model.joblib (이 폴더에서 학습)  | cctv.diagnose                    |
| PUMP        | models/pump_model.joblib (이 폴더에서 학습)  | pump.diagnose                    |
| WATER_LEVEL | models/wl_model.joblib (팀원)               | pdm/pm_final/pdm_wl.diagnose 그대로  |
| DISPLAY     | models/vms_model.joblib (팀원)              | pdm/pm_final/pdm_vms.diagnose 그대로 |

네 종류 모두 같은 모양으로 돌려줘요 (팀원 형식):
  equipment_id, status, risk_score, risk_level, health_index, reasons[{항목, 센서, 현재, 평소, 설명, 영향도}], warnings,
  anomaly_raw + 종류별 키 (CCTV·펌프·전광판 suspected_cause, 수위 anomaly_type, 펌프 sensors)
팀원 결과에는 health_index(100 - 점수)만 더하고, 수위의 sensor_id 는 equipment_id 로 이름만 바꿔요 (값은 그대로).
"""
import logging
import math
from pathlib import Path

import joblib
import numpy as np

from . import cctv, featout, pump
from .teammate import VMS_MODEL, WL_MODEL, pdm_vms, pdm_wl

log = logging.getLogger("pdm")
MODEL_DIR = Path(__file__).resolve().parent.parent / "models"
MODEL_FILES = {"CCTV": MODEL_DIR / "cctv_model.joblib", "PUMP": MODEL_DIR / "pump_model.joblib",
               "WATER_LEVEL": WL_MODEL, "DISPLAY": VMS_MODEL}


def plain(v):
    """numpy 숫자·NaN 을 JSON 으로 보낼 수 있는 값으로"""
    if isinstance(v, dict):
        return {k: plain(x) for k, x in v.items()}
    if isinstance(v, (list, tuple)):
        return [plain(x) for x in v]
    if isinstance(v, np.generic):
        v = v.item()
    if isinstance(v, float) and not math.isfinite(v):
        return None
    return v


def _health(r):
    s = r.get("risk_score")
    r["health_index"] = None if s is None else round(100 - float(s), 1)
    return r


class Models:

    def __init__(self, files=MODEL_FILES):
        """모델 파일을 읽어요. 없거나 못 읽은 종류는 errors 에 남기고 건너뛰어요 (나머지 종류는 동작)"""
        self.bundles, self.errors, self.meta = {}, {}, {}
        for etype, path in files.items():
            try:
                f = joblib.load(path)
                if etype in ("CCTV", "PUMP"):          # train.py 가 만든 파일: {version, trainedAt, model}
                    self.bundles[etype] = f["model"]
                    self.meta[etype] = {"version": f["model"].get("version"), "trainedAt": f.get("trainedAt"),
                                        "file": "models/" + path.name, "by": "이 폴더 (train.py)",
                                        "evaluation": f["model"].get("evaluation")}
                else:                                   # 팀원 번들 그대로
                    self.bundles[etype] = f
                    self.meta[etype] = {"version": f.get("version"), "file": "models/" + path.name,
                                        "by": "팀원 (pm_final)", "note": f.get("note")}
            except FileNotFoundError:
                self.errors[etype] = "모델 파일이 없어요: %s" % path
            except Exception as e:
                self.errors[etype] = "%s: %s" % (type(e).__name__, e)

    def has(self, etype):
        return etype in self.bundles

    def diagnose(self, etype, equipment_id, df, baseline=None, now=None):
        """종류에 맞는 진단. df = 시각 열 + 센서 열 (features.TIME_COL, features.SPECS 의 metrics)"""
        b = self.bundles[etype]
        if etype == "CCTV":
            r = cctv.diagnose(b, equipment_id, df, now)
        elif etype == "PUMP":
            r = pump.diagnose(b, equipment_id, df, now)
        elif etype == "WATER_LEVEL":
            r = pdm_wl.diagnose(b, equipment_id, df, now=now)
            r = {"equipment_id": r.pop("sensor_id"), **r}
        else:
            r = pdm_vms.diagnose(b, equipment_id, df, baseline=baseline, now=now)
        r = _health(r)
        r["features"] = self.features(etype, equipment_id, df, baseline) if r.get("status") == "ok" else []
        return plain(r)

    def features(self, etype, equipment_id, df, baseline=None):
        """이번 점수에 쓰인 특징값 전체 (features[] 규격, pdm/featout.py). 못 만들면 빈 목록"""
        b = self.bundles[etype]
        try:
            if etype == "CCTV":
                return featout.own_features(etype, cctv, b, df)
            if etype == "PUMP":
                return featout.own_features(etype, pump, b, df)
            if etype == "WATER_LEVEL":
                return featout.wl_features(b, df)
            return featout.vms_features(b, equipment_id, df, baseline)
        except Exception:                                  # 화면용 정보라서 점수 계산은 막지 않아요
            log.exception("features 계산 실패: %s %s", etype, equipment_id)
            return []

    def build_baseline(self, df, now=None):
        """전광판 평소 값 (팀원 pdm_vms.build_baseline 그대로). 이력이 10일치 안 되면 None"""
        return plain(pdm_vms.build_baseline(df, now=now))
