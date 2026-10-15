# -*- coding: utf-8 -*-
"""사진 폴더에서 번호판을 찾아요. 사용법: python -u predict.py <사진 폴더 또는 사진>"""
import sys, os                                              # 필요한 도구 상자
from ultralytics import YOLO                                # YOLO 도구
HERE = os.path.dirname(os.path.abspath(__file__))           # 이 파일이 있는 폴더
model = YOLO(os.path.join(HERE, "best.pt"))                 # 모델 불러오기 (파일 하나면 끝)
for r in model.predict(sys.argv[1], imgsz=1280, conf=0.25,  # ★ 크기는 꼭 1280
                       stream=True, save=True,              # 네모 그린 사진 저장
                       project=HERE, name="result", exist_ok=True):
    boxes = r.boxes.xyxy.tolist()                           # 찾은 번호판 네모들 [왼, 위, 오른, 아래]
    print(os.path.basename(r.path), f"번호판 {len(boxes)}개",
          [[round(v) for v in b] for b in boxes], flush=True)  # 사진마다 결과 출력
print("끝: 네모 그린 사진은 result 폴더에 있어요", flush=True)
