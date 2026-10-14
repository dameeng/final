# ROUTEL AI 서버 (FastAPI)

번호판 모델 2개를 서버 하나에서 돌려요. (침수는 다른 PC에서 `flood_server` 폴더로 따로 돌려요)

| 모델 | 하는 일 | 폴더 |
|---|---|---|
| YOLO | CCTV 사진에서 번호판 위치 찾기 | `yolo8!/yolo_plate_far/` |
| PaddleOCR v7 | 잘라낸 번호판 글자 읽기 | `plate_v7_model/` |

결과는 Spring(5555)의 `/api/internal/plate-logs`로 보내요.

---

## 0. 빠른 시작 (팀원용)

1. 이 폴더를 원하는 곳에 풀어요.
2. **영상 넣기**: `front_1.mp4`, `back_1.mp4`를 `자동차영상` 폴더에 넣어요 (용량이 커서 따로 받아요).
3. **`setup.bat` 더블클릭** (처음 한 번, 5~15분). 마지막에 `모두 통과!`가 나오면 끝이에요.
   - Python 3.11이 없으면 자동으로 설치를 시도해요.
   - NVIDIA 그래픽카드가 있으면 GPU용 패키지까지 알아서 설치해요.
4. **Spring을 먼저 켜요.**
5. **`run.bat` 더블클릭.** 창을 닫으면 서버도 꺼져요 (끌 때는 `Ctrl + C` 후 닫기).
6. 프론트를 켜요. AI 서버와 같은 PC면 그냥 `npm run dev`. 다른 PC면 프론트 PC에서
   `$env:ROUTEL_AI_URL = "http://<AI 서버 PC IP>:8000"` 입력 후 `npm run dev`.

**Spring이 다른 PC에 있으면**: 이 폴더에 `spring_url.txt` 파일을 만들고 한 줄만 적어요.
```
http://192.168.0.80:5555
```
파일이 없으면 자기 PC의 Spring(`http://localhost:5555`)으로 보내요.

**그래픽카드가 없는 PC**: `run.bat`이 알아서 CPU 설정(탐지 0.5초 간격, 인식 스레드 4개, 화면 지연 2.5초)으로 켜요.

> ⚠️ Spring 하나에는 AI 서버 하나만 연결하세요. 같은 Spring에 AI 서버 두 대가 붙으면 기록이 두 번씩 쌓여요.

---

## 1. 준비물

- **Windows + Python 3.11** (3.12/3.13 안 됨)
  - 확인: `py -0p` → 목록에 `-V:3.11`이 있어야 해요
  - 없으면 python.org에서 3.11 설치 (설치 화면에서 "Add python.exe to PATH" 체크)
- 그래픽카드는 없어도 돼요 (CPU로 돌아감. YOLO 약 0.2초/장)

---

## 2. 폴더 받기

이 `fastapi` 폴더를 통째로 받으세요. **단, 아래 폴더는 PC마다 새로 만들어야 해서 주고받지 않아요.**

| 폴더 | 이유 |
|---|---|
| `venv/` | 설치된 프로그램 묶음. 다른 PC로 복사하면 안 돌아가요 (용량도 수 GB) |

압축해서 줄 때는 위 폴더를 빼고 압축하세요.

---

## 3. 설치 (자동, 추천)

**`setup.bat`을 더블클릭**하면 끝이에요. (끝나면 창이 닫히지 않고 결과를 보여줘요)

알아서 아래를 순서대로 해요 (처음엔 5~15분).
1. Python 3.11 확인 (없으면 winget으로 설치 시도)
2. 가상환경 `venv` 만들기
3. `requirements.txt` 패키지 설치 + OpenCV 정리 (겹치는 것 삭제)
4. NVIDIA 그래픽카드가 있으면 GPU용 패키지 설치 (6번 내용)
5. `test_env.py`로 모델 2개 점검

마지막에 이렇게 나오면 성공이에요.
```
  ✅ 1. 패키지
  ✅ 2. YOLO (번호판 위치)
  ✅ 3. OCR (번호판 글자)
모두 통과! 서버 하나로 모델 2개가 다 돌아가요.
```

중간에 멈추면 `[FAIL]`과 함께 어느 단계에서 실패했는지 나와요. 에러를 고친 뒤 **`setup.bat`을 다시 실행**하면, 이미 끝난 단계(가상환경)는 건너뛰고 이어서 해요.

---

## 3-1. 설치 (수동, 자동이 안 될 때)

한 줄씩 실행하세요.

```powershell
py -3.11 -m venv venv
.\venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
pip uninstall -y opencv-python opencv-python-headless
pip install --force-reinstall --no-deps opencv-contrib-python==5.0.0.93
python -u test_env.py
```

- `Activate.ps1`에서 "스크립트를 실행할 수 없습니다" 에러가 나면 먼저 실행:
  `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`
- 성공하면 줄 앞에 `(venv)`가 붙어요.

---

## 4. 매번 쓸 때

```powershell
cd C:\경로\project\fastapi
.\venv\Scripts\Activate.ps1
```

`(venv)`가 붙은 상태에서 파이썬 명령을 실행하세요. 새 PowerShell 창을 열 때마다 다시 켜야 해요.

---

## 4-1. AI 서버 켜기

**Spring(5555)을 먼저 켜고**, `run.bat`을 더블클릭하세요. (명령어: `.\venv\Scripts\python.exe -m uvicorn fast_api:app --host 0.0.0.0 --port 8000`)

켜지면 이렇게 나와요.
```
13:43:37 [server] 번호판 모델(YOLO + OCR) 로드 완료
```
끄려면 창에서 `Ctrl + C`.

### 지금 되는 기능

| 기능 | 설명 |
|---|---|
| 번호판 인식 | **실행 버튼(`/control/plate/start`)을 눌러야 시작.** 카메라(`config.CAMERAS`)마다: 영상 → YOLO → OCR → 형식/중복 검사 → 스크린샷과 함께 `POST /api/internal/plate-logs` |
| `POST /control/plate/start` | 영상 처음부터 재생 + 번호판 인식/전송 시작 (헤더 `X-Internal-Api-Key` 필요. Spring이 호출) |
| `POST /control/plate/stop` | 영상 + 인식/전송 정지 (헤더 `X-Internal-Api-Key` 필요) |
| `GET /control/plate` | 지금 돌고 있는지 (버튼 상태 표시용) |
| `GET /plate/status` | 카메라별 상태 + 최근 전송 기록 |
| `POST /plate/read` | 사진 올려서 번호판 읽기 (저장 안 함) |
| `POST /plate/read-image` | 사진 올려서 네모 그린 사진 받기 (저장 안 함) |
| `GET /stream/{카메라id}` | 관리자 CCTV 화면용 실시간 탐지 영상 (MJPEG, 약 4초 지연) |
| `GET /stream/{카메라id}/snapshot` | 지금 화면 한 장 (jpg) |

http://localhost:8000/docs 에서 버튼으로 바로 테스트할 수 있어요.

### 설정 (`config.py` 또는 환경변수)

| 이름 | 기본값 | 설명 |
|---|---|---|
| `SPRING_URL` | `http://localhost:5555` | Spring 주소 |
| `INTERNAL_API_KEY` | `dev-internal-key-change-me` | Spring `puf.internal.api-key`와 같아야 함 |
| `PLATE_ENABLED` | `0` | `1`이면 실행 버튼 없이 서버 켤 때 바로 카메라 인식 시작 |
| `CAMERAS` | `{1: front_1.mp4, 2: back_1.mp4}` | 카메라 id(DB `underpass_camera.id`) → 영상 (config.py에서 수정) |
| `VIDEO_DIR` | `fastapi/videos` | 시연 영상 폴더. PC마다 달라서 보통 환경변수로 지정 (`실행명령어.txt` 참고) |
| `DETECT_SKIP_TOP` | `{1: 0.28}` | 카메라별로 화면 위쪽 몇 %는 번호판 탐지를 건너뜀 (config.py에서 수정) |
| `PLATE_INTERVAL_SEC` | `0.3` | 카메라마다 몇 초에 한 번 탐지할지. 그래픽카드 없는 PC는 `run.bat`이 `0.5`를 넣어줘요 (0.3은 CPU를 너무 써서 브라우저가 버벅임) |
| `TRACK_SKIP_OCR` | `1` | 이미 전송한 차는 위치만 따라가고 OCR 을 다시 안 함 (OCR 횟수 20~40% 감소, 전송되는 번호는 같음). `0`이면 전부 OCR |
| `VIDEO_SEND_UNTIL_SEC` | `{1: 296}` | 카메라별로 영상의 몇 초까지만 전송. 입구 영상 끝부분은 출구 영상에 장면이 없어서 안 보냄 |
| `EXIT_OF` / `EXIT_MATCH_SEC` | `{2: 1}` / `30` | 출구 카메라 → 입구 카메라. 출구에서 읽은 번호의 숫자가 30초 안에 입구에서 보낸 번호와 같으면 입구 번호 그대로 보냄 (한글 한 글자 오인식 보정) |
| `VIDEO_DELAY_SEC` | `{2: 4.5}` | 카메라별 영상 시작 지연(초). 출구 영상을 늦춰 입구 → 출구 순서를 맞춤. 영상들은 매 바퀴 같이 처음으로 돌아가요 (config.py에서 수정) |
| `FONT_PATH` | `C:\Windows\Fonts\malgun.ttf` | 영상에 번호(한글)를 쓸 글꼴 |

### Spring 쪽 설정

`application.properties`에 `puf.weather-stub.enabled=false`가 있어야 해요.
(없으면 Spring의 임시 가짜 점수 스케줄러가 같이 돌아서 점수가 섞여요)

---

## 5. 자주 나는 문제

| 증상 | 해결 |
|---|---|
| `py -3.11` 에서 "No suitable Python runtime" | Python 3.11이 없어요. 1번 준비물 참고 |
| `pip check`에 `ultralytics requires opencv-python, which is not installed` | **정상이에요. 무시하세요.** 일부러 opencv-contrib-python 하나만 남긴 거라 나오는 메시지예요 |
| `import cv2`에서 에러 / `cv2` 관련 이상한 에러 | OpenCV가 겹쳤어요. 3-1의 `pip uninstall ...`, `pip install --force-reinstall ...` 두 줄 다시 실행 |
| 3번 OCR에서 `No module named 'tools'` | `plate_v7_model/paddleocr_lib` 폴더가 빠졌어요. v7 폴더를 통째로 다시 복사 |
| 3번 OCR에서 `No module named 'albumentations'` | `pip install albumentations==2.0.8 stringzilla==5.1.1` 후 3-1의 OpenCV 정리 두 줄 다시 실행 |
| 3번 OCR에서 `ConvertPirAttribute2RuntimeAttribute not support` | CPU 가속(oneDNN) 문제예요. `plate_ocr.py`의 `d.enable_mkldnn = False` 줄이 있는지 확인 |
| `torch` 불러올 때 `WinError 127` (`shm.dll`) | paddle 을 torch 보다 먼저 불러서 나는 에러. `ultralytics`(torch)를 먼저 import 해야 해요 |
| `No ccache found` 경고 | 무시해도 돼요 (Paddle이 항상 띄우는 경고) |
| 처음 실행이 오래 걸림 | 정상이에요. 모델을 처음 불러올 때만 느려요 |
| `401 ... 유효하지 않은 내부 API 키` | `config.py`의 `INTERNAL_API_KEY`와 Spring `puf.internal.api-key`가 달라요 |
| `run.bat` 실행 시 포트 8000 사용 중 | 이미 AI 서버가 켜져 있어요. 기존 창을 끄고 다시 실행 |

---

## 6. NVIDIA 그래픽카드가 있는 PC라면 (선택)

CPU 설치 그대로도 돌아가요. 더 빠르게 하고 싶으면 설치 후에 아래 명령으로 GPU용으로 바꾸세요.
Paddle과 torch가 **같은 CUDA 12.6**을 쓰도록 맞춘 거예요 (cu118 쓰면 충돌 가능).

```powershell
pip install --force-reinstall --no-deps torch==2.7.1 torchvision==0.22.1 --index-url https://download.pytorch.org/whl/cu126
pip uninstall -y paddlepaddle
pip install paddlepaddle-gpu==3.3.1 --extra-index-url https://www.paddlepaddle.org.cn/packages/stable/cu126/
pip install --no-deps nvidia-cudnn-cu12==9.7.1.26
python -u test_env.py
```
- `torchvision` 도 cu126 으로 바꿔야 해요. 안 바꾸면 YOLO 에서 `Could not run 'torchvision::nms' ... 'CUDA' backend` 에러
- 마지막 cudnn 줄은 torch(cuDNN 9.7)와 paddle(9.5)의 버전을 맞추는 거예요. 안 하면 `WinError 127 ... cudnn_engines_precompiled64_9.dll` 에러
  (그 뒤 뜨는 `compiled with CUDNN 9.9, but ... 9.7` 경고는 무시해도 돼요)
→ `그래픽카드 사용: torch True, paddle True`가 나오면 성공.

---

## 7. 폴더 구조

```
fastapi/
├─ README.md            이 파일
├─ setup.bat            자동 설치 (처음 한 번 더블클릭)
├─ spring_url.txt       (선택) 다른 PC의 Spring 주소 한 줄. 없으면 localhost:5555
├─ requirements.txt     설치할 패키지 목록
├─ test_env.py          모델 2개 점검
├─ run.bat              서버 켜기 (더블클릭)
├─ fast_api.py          서버 본체 (API 주소들)
├─ config.py            설정 (Spring 주소, API 키, 간격)
├─ spring.py            Spring과 주고받는 함수
├─ plate_ocr.py         [번호판] 번호판 인식 + 카메라별 자동 인식/전송
├─ plate_v7_model/      OCR 모델 v7 (모델 3개 + 실행 코드 paddleocr_lib, 사용법.md)
├─ yolo8!/yolo_plate_far/  YOLO 모델 (best.pt)
└─ venv/                가상환경 (PC마다 새로 만듦, 공유 X)
```
