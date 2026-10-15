# -*- coding: utf-8 -*-
"""AI 서버 설정. 값을 바꾸려면 여기를 고치거나, 같은 이름의 환경변수로 덮어쓰면 돼요."""
import os

HERE = os.path.dirname(os.path.abspath(__file__))

# ===== Spring 백엔드 =====
SPRING_URL = os.environ.get("SPRING_URL", "http://localhost:5555")
# application.properties 의 puf.internal.api-key 와 같아야 해요
INTERNAL_API_KEY = os.environ.get("INTERNAL_API_KEY", "dev-internal-key-change-me")
HTTP_TIMEOUT_SEC = 5

# ===== 번호판 인식 =====
PLATE_ENABLED = os.environ.get("PLATE_ENABLED", "0") == "1"      # 1이면 서버 켤 때 바로 카메라 인식 시작 (0이면 실행 버튼 기다림)
YOLO_PATH = os.path.join(HERE, "yolo8!", "yolo_plate_far", "best.pt")
# CPU 용 YOLO (인텔 OpenVINO 로 바꾼 것. 같은 모델인데 CPU 에서 약 3배 빠름). 폴더가 없거나 그래픽카드 PC면 위 best.pt 사용
#   만들기: venv\Scripts\python.exe -c "from ultralytics import YOLO; YOLO(r'yolo8!\yolo_plate_far\best.pt').export(format='openvino', imgsz=1280, dynamic=True)"
YOLO_OPENVINO_XML = os.path.join(HERE, "yolo8!", "yolo_plate_far", "best_openvino_model", "best.xml")
# 글자 읽는 OCR 모델 (PaddleOCR v7. 실행 코드 paddleocr_lib 까지 폴더 안에 다 들어 있어요)
PLATE_V7_DIR = os.path.join(HERE, "plate_v7_model")
# 번호판 안 글자 줄 찾기(det) 모델 폴더 (plate_v7_model/models 안). det = 서버용(88MB), det_mobile = 모바일용(5MB)
#   bench.py 측정: 모바일이 OCR 시간 절반 이하(940 -> 432ms), 전송되는 번호는 같거나 1개 더. 되돌리려면 "det"
PLATE_DET_MODEL = os.environ.get("PLATE_DET_MODEL", "det_mobile")
# det 모델에 CPU 가속(oneDNN) 켜기. 서버용 det 는 켜면 NotImplementedError 로 멈춰서 기본은 끔
DET_MKLDNN = os.environ.get("DET_MKLDNN", "0") == "1"
USE_GPU = os.environ.get("USE_GPU", "1") == "1"   # 1이면 그래픽카드로 OCR (그래픽카드 없는 PC는 0)
# CPU 에서 번호판 인식(YOLO + OCR)이 쓸 스레드 수. 0 = 자동 (논리 코어 수 - 2)
#   Paddle 기본값 10 은 8코어 노트북의 코어 수보다 많아서, 스트림 화면 만들 CPU 를 남겨 두려고 줄임
INFER_THREADS = int(os.environ.get("INFER_THREADS", "0")) or max(1, (os.cpu_count() or 4) - 2)
# 번호판 인식을 따로 띄운 프로세스에서 돌릴지. CPU 에서는 같은 프로세스면 인식하는 동안 파이썬(GIL)이
# 스트림 화면 만드는 것까지 멈춰서 영상이 끊겨요 (측정: 6fps, 0.3초 넘게 멈춤 30번/30초). 기본: 그래픽카드 없으면 1
READER_PROCESS = os.environ.get("READER_PROCESS", "0" if USE_GPU else "1") == "1"
# 스트림/스크린샷에 번호(한글)를 쓸 글꼴. 없으면 번호 없이 점수만 표시
FONT_PATH = os.environ.get("FONT_PATH", r"C:\Windows\Fonts\malgun.ttf")

# 시연 영상 폴더. PC마다 다르니 서버 켜기 전에 환경변수로 지정:
#   $env:VIDEO_DIR = "C:\...\public\videos"
# 지정 안 하면 AI 서버 폴더 안의 자동차영상 폴더에서 찾아요
VIDEO_DIR = os.environ.get("VIDEO_DIR", os.path.join(HERE, "자동차영상"))

# 카메라 id (DB underpass_camera.id) -> 영상.  파일 이름이면 VIDEO_DIR 에서 찾고, rtsp:// 주소도 가능
#   1 = 월계3지하차도 APPROACH_LPR(300m 전, 입구 지정)
#   2 = 월계3지하차도 ROI_LPR(30m 전, 출구 지정)
# 통과 테스트: front_1(입구)에서 찍힌 차가 1~8초 뒤 back_1(출구)에 나와서 "통과 완료"까지 확인 가능
# 카메라 id 확인 SQL: SELECT c.id, u.name, c.camera_role FROM underpass_camera c JOIN underpass u ON u.id = c.underpass_id ORDER BY c.id;
# 시연: 카메라 1(입구)만, front_1 장면 30초 영상 (출구 카메라 2를 쓰려면 2: "back_1.mp4" 를 다시 추가)
CAMERAS = {
    1: "KakaoTalk_20261002_140817269.mp4",
}

# 카메라별로 화면 위쪽 몇 %는 번호판 탐지를 건너뛸지 (0.28 = 위 28%). 없는 카메라는 0 (전체 탐지)
#   front 영상: 위쪽은 번호판이 너무 작아 거의 못 읽음(맞게 읽는 비율 4~14%) -> 잘라내면 탐지가 약 20% 빨라짐
#   back 영상: 위쪽 번호판도 커서 잘 읽힘 -> 자르지 않음
DETECT_SKIP_TOP = {
    1: 0.28,
}

# 카메라별로 영상을 몇 초 늦게 시작할지 (영상 파일만). 없는 카메라는 0
#   back_1 은 front_1 보다 차가 너무 빨리 지나가서, 입구에서 확정(2번 읽기)되기 전에 출구에서 먼저 찍힘
#   -> 4.5초 늦춰서 입구 -> 출구 순서가 확실하게 나오게 함 (통과 완료가 더 많이 생김)
VIDEO_DELAY_SEC = {
    2: 4.5,
}
# 영상 파일들은 항상 같이 처음으로 돌아가요 (가장 긴 영상 + 딜레이 기준).
# 짧은 영상은 끝나면 마지막 화면에서 기다렸다가 같이 다시 시작 -> 몇 바퀴를 돌아도 입구/출구 시간 차가 그대로

# 카메라별로 영상의 몇 초까지만 번호를 전송할지 (영상 파일만). 없는 카메라는 끝까지 전송
#   front_1(316.7초)이 back_1(302.1초)보다 길어서, 입구 영상 296초 이후에 나온 차는 출구 영상에 장면이 없음
#   -> 보내면 통과 완료가 안 되고 "통과 중"으로만 남아서 안 보냄
VIDEO_SEND_UNTIL_SEC = {
    1: 296,
}

# 카메라마다 몇 초에 한 번 탐지할지. 그래픽카드 PC는 0.3 (출구 카메라는 차가 빨리 지나가서 1초면 한 번밖에 못 읽음)
# 그래픽카드 없는 PC는 run.bat 이 0.5 + INFER_THREADS=4 를 넣어줘요.
#   0.3 은 인식이 거의 쉬지 않아서 python 이 CPU 60%(전체 88%)를 써서 브라우저 화면이 버벅였어요 (전송 번호는 0.3 이 2개 더)
PLATE_INTERVAL_SEC = float(os.environ.get("PLATE_INTERVAL_SEC", "0.3"))
# 번호판 네모 너비가 이 픽셀보다 작으면 OCR 을 건너뜀 (너무 작아서 빈 결과/오독이 대부분, OCR 시간 약 36% 절약)
#   front 영상 측정(bench.py): 60px 미만은 절반 이상 빈 결과, 전송되는 번호는 그대로. 카메라가 바뀌면 다시 재볼 것. 0 = 다 읽음
OCR_MIN_WIDTH = int(os.environ.get("OCR_MIN_WIDTH", "60"))
# YOLO 에 넣는 사진 크기(긴 쪽 px). 사진이 이보다 작으면 키우지 않음. 줄이면 빠르지만 먼(작은) 번호판을 놓칠 수 있음
#   front 영상(1280x720) bench.py 측정: 1280 -> 960 에서 YOLO 135 -> 80ms, 전송되는 번호는 안 빠지고 1개 더(경기31바2658).
#   못 찾게 된 네모는 어차피 OCR 을 건너뛰는 60px 미만뿐. 800 이하는 196하4681 을 196하4481 로 잘못 읽어서 안 씀. 되돌리려면 1280
YOLO_IMGSZ = int(os.environ.get("YOLO_IMGSZ", "960"))
YOLO_CONF = 0.25          # 이 자신감보다 낮은 번호판 네모는 버림 (README: 놓치면 0.15, 엉뚱하면 0.4)
OCR_MIN_SCORE = 0.3      # OCR 자신감이 이보다 낮으면 안 보냄 (시험 계산: 0.90→0.85에서 정답 +29, 틀림 +3)
# 잘못 읽은 번호가 쌓이지 않게: 같은 번호를 CONFIRM_WINDOW_SEC 초 안에 CONFIRM_COUNT 번 읽어야 전송
# (단, OCR 자신감이 INSTANT_SCORE 이상이면 한 번만 읽어도 바로 전송)
CONFIRM_COUNT = 2
CONFIRM_WINDOW_SEC = 10
INSTANT_SCORE = 0.99
RESEND_SEC = 60           # 같은 카메라에서 같은 번호는 이 시간 안에 다시 안 보냄
# "같은 번호"는 숫자 부분으로 비교해요. 한글 한 글자만 다르게 읽은 것(174어6751 / 174하6751)은 같은 차로 봐서
# 두 번 보내지 않음 -> 잘못 읽은 번호가 Spring 에 "통과 중"으로 따로 쌓이지 않게

# 이미 전송한 차는 화면에서 따라가기만 하고 OCR 을 다시 안 함 (전송 뒤에 또 읽어 봐야 RESEND_SEC 때문에 안 보내니까)
#   직전 두 탐지로 속도를 재서 다음 위치를 예상 -> 그 근처(번호판 너비의 TRACK_MAX_DIST 배 안)에 네모가 딱 하나면 같은 차
#   front 영상 측정: 예상 위치와 같은 차 차이 최대 0.24배, 다른 차는 2.6배 이상. 0 이면 끔 (전부 OCR)
TRACK_SKIP_OCR = os.environ.get("TRACK_SKIP_OCR", "1") == "1"
TRACK_MAX_DIST = 0.6

# 출구 카메라 -> 같은 지하차도의 입구 카메라.
# 출구에서 읽은 번호의 숫자 부분이 최근 EXIT_MATCH_SEC 초 안에 입구에서 보낸 번호와 같으면
# 입구에서 보낸 번호 그대로 바로 전송 (한글 한 글자를 다르게 읽어도 통과 완료가 되게, 한 번만 읽어도 되게)
EXIT_OF = {
    2: 1,
}
EXIT_MATCH_SEC = 30

# ===== 시연 페이지 (front2) =====
# 버튼 -> 카메라 id (DB underpass_camera.id). 사진을 이 카메라에서 찍힌 것처럼 Spring 에 보내요
#   1 = 월계3지하차도 APPROACH_LPR, 2 = 월계3지하차도 ROI_LPR
DEMO_CAMERAS = {
    "APPROACH": 1,
    "ROI": 2,
}

# ===== 관리자 CCTV 화면용 실시간 영상 (GET /stream/{카메라id}) =====
# 영상 풀기(디코딩)를 그래픽으로 할지. 내장 그래픽 노트북은 CPU 가 더 빨라서 기본 0 (1 = 그래픽)
VIDEO_HW_DECODE = os.environ.get("VIDEO_HW_DECODE", "0") == "1"
STREAM_FPS = int(os.environ.get("STREAM_FPS", "24"))   # 초당 몇 장 보낼지. 원본 영상이 24fps 라 12 면 끊겨 보임 (CPU 측정: 12 -> 10.7fps, 24 -> 19.8fps, 탐지는 약 20% 줄어듦)
STREAM_WIDTH = 960        # 화면 가로 크기(px). 원본 1920 -> 960 으로 줄여서 보냄
STREAM_QUALITY = 70       # jpg 화질 (0~100)
# CPU 에서는 탐지가 1~2초 걸려서, 화면을 이만큼 늦게 보여주고 앞뒤 탐지 사이 네모 위치를 계산해서 그려요
# (탐지 간격 + 탐지 시간보다 커야 네모가 번호판을 잘 따라가요. 그래픽카드 PC면 2로 줄여도 됨)
STREAM_DELAY_SEC = float(os.environ.get("STREAM_DELAY_SEC", "2.0"))   # run.bat 이 그래픽카드 없는 PC에서는 2.5 를 넣어줘요
STREAM_BOX_HOLD_SEC = 2.0  # 다음 탐지에서 못 찾은 네모를 몇 초 더 보여줄지