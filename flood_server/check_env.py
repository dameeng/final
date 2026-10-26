# -*- coding: utf-8 -*-
"""설치 점검: 패키지 버전, 침수모델 로드/계산, (선택) Spring 연결 확인.
실행: venv\\Scripts\\python.exe -u check_env.py   (setup.bat 마지막에 자동 실행돼요)
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
ok = True


def step(title):
    print("\n[%s]" % title)


step("1. 패키지 버전")
EXPECT = {"numpy": "2.4.6", "pandas": "3.0.5", "sklearn": "1.9.1", "joblib": "1.6.0"}
for name in ["numpy", "pandas", "sklearn", "joblib", "fastapi", "uvicorn", "requests"]:
    try:
        mod = __import__(name)
        ver = getattr(mod, "__version__", "?")
        want = EXPECT.get(name)
        flag = "" if (want is None or ver == want) else "   <-- 버전이 달라요 (필요: %s)" % want
        if flag:
            ok = False
        print("  %-8s %s%s" % (name, ver, flag))
    except Exception as e:
        ok = False
        print("  %-8s 불러오기 실패: %s" % (name, e))

step("2. 침수모델")
try:
    import config
    from flood_risk import FloodPredictor
    p = FloodPredictor()
    r = p.predict([{"rainfallMm": 40, "rainfall1hMm": 10, "rainfall3hMm": 60, "rainfall6hMm": 70,
                    "rainfall12hMm": 70, "rainfall24hMm": 70, "heightM": 3.6, "lengthM": 304}])[0]
    print("  OK  위험점수 %s, 위험단계 %s  (사용법.txt 기본값 기준 약 94.0 / 2 가 나와야 정상)" % (r["riskScore"], r["riskLevel"]))
except Exception as e:
    ok = False
    print("  FAIL  %s" % e)

step("3. Spring 연결 (선택: 꺼져 있어도 서버 실행엔 문제 없어요)")
try:
    import spring
    spring.health()
    print("  OK  %s (API 키 통과)" % config.SPRING_URL)
except Exception as e:
    print("  연결 안 됨: %s" % e)
    print("  -> Spring 을 켜고 나서 run.bat 을 실행하세요. 401 이면 config.py 의 INTERNAL_API_KEY 를 확인하세요.")

print("\n" + ("=== 점검 통과 ===" if ok else "=== 위 FAIL / 버전 경고를 먼저 해결하세요 ==="))
sys.exit(0 if ok else 1)
