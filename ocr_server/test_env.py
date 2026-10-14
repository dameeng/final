# -*- coding: utf-8 -*-
"""AI 서버 환경 점검: 모델 2개(YOLO, OCR)가 이 PC에서 다 돌아가는지 확인해요.
사용법: .\\venv\\Scripts\\python.exe -u test_env.py
"""
import io, os, sys, time, traceback
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")  # 한글 안 깨지게

HERE = os.path.dirname(os.path.abspath(__file__))
YOLO_PT = os.path.join(HERE, "yolo8!", "yolo_plate_far", "best.pt")

results = {}


def step(name):
    """단계 하나를 실행하고, 실패해도 다음 단계는 계속 검사"""
    def wrap(fn):
        print(f"\n[{name}]", flush=True)
        try:
            fn()
            results[name] = True
        except Exception:
            traceback.print_exc(limit=2)
            results[name] = False
    return wrap


@step("1. 패키지")
def _():
    import numpy, cv2, torch, ultralytics, paddle, fastapi
    print(f"   numpy {numpy.__version__} | opencv {cv2.__version__} | torch {torch.__version__}"
          f" | ultralytics {ultralytics.__version__} | paddle {paddle.__version__}"
          f" | fastapi {fastapi.__version__}")
    print(f"   그래픽카드 사용: torch {torch.cuda.is_available()}, paddle {paddle.device.is_compiled_with_cuda()}")


@step("2. YOLO (번호판 위치)")
def _():
    import numpy as np
    from ultralytics import YOLO
    yolo = YOLO(YOLO_PT)
    img = np.zeros((720, 1280, 3), np.uint8)
    yolo.predict(img, imgsz=1280, verbose=False)            # 첫 실행은 준비 시간이 섞여서 버림
    t = time.time()
    yolo.predict(img, imgsz=1280, verbose=False)
    print(f"   OK ({time.time() - t:.2f}초/장)")


@step("3. OCR (번호판 글자)")
def _():
    import numpy as np
    from plate_ocr import PlateReader                       # 서버와 똑같이 v7 불러오기 (plate_v7_model/)
    ocr = PlateReader._load_ocr()
    img = np.full((48, 160, 3), 255, np.uint8)
    cv2 = __import__("cv2")
    cv2.putText(img, "12 3456", (8, 34), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 0), 2)   # 글자가 있어야 끝까지 돌아요
    ocr.read(img)
    t = time.time()
    text, score, _ = ocr.read(img)
    print(f"   OK ({time.time() - t:.2f}초/장)  테스트 그림 결과: '{text}' ({score:.2f})")


print("\n========== 결과 ==========")
for name, ok in results.items():
    print(f"  {'✅' if ok else '❌'} {name}")
print("\n모두 통과! 서버 하나로 모델 2개가 다 돌아가요." if all(results.values())
      else "\n❌ 난 단계의 에러 메시지를 README.md '자주 나는 문제'에서 찾아보세요.")
sys.exit(0 if all(results.values()) else 1)
