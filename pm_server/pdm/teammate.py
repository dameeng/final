# -*- coding: utf-8 -*-
"""팀원 최종 모델(pm_final)을 불러와요. 팀원 파일은 내용을 고치지 않고 위치만 옮겼어요.

pdm/pm_final/pdm_common.py  점수 눈금(0~100)·등급·연속 조건 (CCTV·펌프도 같은 것을 써요)
pdm/pm_final/pdm_wl.py      수위센서 diagnose()                 + models/wl_model.joblib
pdm/pm_final/pdm_vms.py     전광판 diagnose()·build_baseline()  + models/vms_model.joblib
"""
import sys
from pathlib import Path

PM_DIR = Path(__file__).resolve().parent / "pm_final"
MODEL_DIR = Path(__file__).resolve().parent.parent / "models"
if str(PM_DIR) not in sys.path:
    sys.path.insert(0, str(PM_DIR))      # 팀원 파일끼리 'from pdm_common import ...' 로 서로 불러요

import pdm_common  # noqa: E402
import pdm_vms  # noqa: E402
import pdm_wl  # noqa: E402
from pdm_common import level_of, make_anchors, sustained, to_risk  # noqa: E402,F401

WL_MODEL = MODEL_DIR / "wl_model.joblib"
VMS_MODEL = MODEL_DIR / "vms_model.joblib"

__all__ = ["pdm_common", "pdm_wl", "pdm_vms", "level_of", "make_anchors", "sustained", "to_risk", "WL_MODEL", "VMS_MODEL"]
