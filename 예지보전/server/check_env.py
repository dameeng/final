# -*- coding: utf-8 -*-
"""설치 점검: 패키지 버전, 펌프 모델 로드/계산.
실행: venv\\Scripts\\python.exe -u check_env.py   (setup.bat 마지막에 자동 실행돼요)
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
ok = True


def step(title):
    print("\n[%s]" % title)


step("1. 패키지 버전")
# 모델을 학습한 버전과 같아야 joblib 파일이 문제없이 열려요
EXPECT = {"numpy": "2.4.6", "pandas": "3.0.5", "sklearn": "1.9.1", "joblib": "1.6.0", "lightgbm": "4.7.0"}
for name in ["numpy", "pandas", "sklearn", "joblib", "lightgbm", "fastapi", "uvicorn", "multipart"]:
    try:
        mod = __import__(name)
        ver = getattr(mod, "__version__", "?")
        want = EXPECT.get(name)
        flag = "" if (want is None or ver == want) else "   <-- 버전이 달라요 (필요: %s)" % want
        if flag:
            ok = False
        print("  %-9s %s%s" % (name, ver, flag))
    except Exception as e:
        ok = False
        print("  %-9s 불러오기 실패: %s" % (name, e))

step("2. 펌프 모델")
try:
    import pandas as pd

    import config
    from pump_service import PumpPredictor
    p = PumpPredictor()
    print("  OK  모델 로드 (센서 %d개, %d시간 조기경보)" % (len(p.sensors), p.horizon_h))
    if os.path.isfile(config.PUMP_DEMO_CSV):
        raw = pd.read_csv(config.PUMP_DEMO_CSV, nrows=60 * 80)   # 앞부분 80시간만
        r = p.run(p.from_records(raw.to_dict("records")))
        print("  OK  계산 테스트: %s" % r["latest"])
    else:
        print("  (데모 CSV 가 없어 계산 테스트는 건너뜀: %s)" % config.PUMP_DEMO_CSV)
except Exception as e:
    ok = False
    print("  FAIL  %s" % e)

print("\n" + ("=== 점검 통과 ===" if ok else "=== 위 FAIL / 버전 경고를 먼저 해결하세요 ==="))
sys.exit(0 if ok else 1)
