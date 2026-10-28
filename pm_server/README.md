# 예지보전 AI 서버 (FastAPI, 포트 8002)

**CCTV · 배수펌프 · 수위센서 · 전광판** 예지보전. 두 가지 방식으로 써요.

1. **Spring 연동 (기본)**: 이 서버가 Spring 에서 장비 목록·센서 데이터를 직접 가져와 점수·근거·특징값(`features`)을 계산하고, 결과를 Spring 에 보내요.
   Spring 은 점수를 저장하고 `pm_threshold` 로 단계를 판정해 이벤트·알림·화면 갱신을 만들어요. (아래 "Spring 연동" 참고)
2. **계산 API**: 센서 데이터를 직접 보내면 점수를 응답으로 돌려줘요 (`POST /predict/{종류}`). 개발·확인용.

```
Spring ◀──(장비·센서 조회, 1분마다)── 이 서버 ──(점수·근거·특징값, backfill=true/false)──▶ Spring : 저장 · 등급 판정 · 이벤트 · 알림 · 화면
```

| 종류 | 경로 | 모델 | 데이터 간격 · 필요 개수 |
|---|---|---|---|
| CCTV | `/predict/cctv` | 이 폴더에서 학습 (`models/cctv_model.joblib`) | 1시간 · 최근 14개 |
| 배수펌프 | `/predict/pump` | 이 폴더에서 학습 (`models/pump_model.joblib`) | 10초 · 최근 35개 |
| 수위센서 | `/predict/waterlevel` | **팀원 모델 그대로** (`pdm/pm_final/pdm_wl.py`, `models/wl_model.joblib`) | 5분 · 최소 300개 (권장 2~3일) |
| 전광판 | `/predict/vms` | **팀원 모델 그대로** (`pdm/pm_final/pdm_vms.py`, `models/vms_model.joblib`) | 1시간 · 최소 24개 (권장 72시간) + 평소 값 |

- 입력 컬럼 전체: `docs/센서_컬럼_목록.txt` 또는 `GET /spec`
- 팀원이 준 파일(`pdm/pm_final/` 코드 3개, `models/` 의 wl·vms 모델, `docs/` 의 README·설명서)은 **한 글자도 고치지 않고** 위치만 옮겼어요. 팀원 예시 입력을 넣으면 팀원 예시 출력과 점수·근거가 똑같이 나와요 (수위 81.9 위험, 전광판 86.4 위험, 2026-10-24 확인)

## 폴더
```
예지보전 모델├─ main.py      서버 (계산 전용)          ├─ train.py   CCTV·펌프 모델 학습
├─ config.py · run.bat · setup.bat · requirements.txt · README.md
├─ models\      모델 파일 4개
│   ├─ cctv_model.joblib · pump_model.joblib     (이 폴더에서 학습, train.py)
│   └─ wl_model.joblib · vms_model.joblib        (팀원, 원본 그대로)
├─ pdm\         코드
│   ├─ cctv.py · pump.py      CCTV·펌프 모델 (진단 + 학습)
│   ├─ diag.py                CCTV·펌프 공통 (팀원 방식: 점수 눈금·알림 기준·사유)
│   ├─ features.py            종류별 센서·특징 정의       ├─ samples.py  학습 데이터 (펌프 10초 가공)
│   ├─ model.py               모델 4개 묶음 (서버가 씀)    ├─ teammate.py 팀원 코드 불러오기
│   └─ pm_final\              팀원 코드 원본 그대로: pdm_common.py · pdm_wl.py · pdm_vms.py
├─ data\        학습 데이터: cctv_sample.csv · pump_sample.csv(1분 원본) · pump_sample_10s.csv(10초 가공, 없으면 train.py 가 만듦)
└─ docs\        센서_컬럼_목록.txt · 팀원_pm_final_README.md · 예지보전_최종모델_설명서.txt
```
- `requirements.txt` 의 scikit-learn · pandas · numpy · joblib 버전은 팀원 모델을 만든 버전과 같아요 (팀원 requirements.txt 와 같아서 하나로 합쳤어요)

## 실행
1. `setup.bat` (처음 한 번, Python 3.13)
2. `run.bat` → http://localhost:8002/docs
3. 확인: http://localhost:8002/health (모델 4개 `ok`)

## API
| API | 내용 |
|---|---|
| `GET /health` | 모델 4개 상태 · 버전 · CCTV·펌프 시험 결과 |
| `GET /spec` | 종류별 시각 열 이름 · 센서 열 · 간격 · 최소 개수 · 예시 한 줄 |
| `POST /predict/{cctv\|pump\|waterlevel\|vms}` | 설비 1대 |
| `POST /predict/{...}/batch` | 여러 대 한 번에 (`{"items": [요청, ...]}`), 한 대가 실패해도 나머지는 계산 |
| `POST /baseline/vms` | 전광판 평소 값 만들기 (팀원 `build_baseline` 그대로, 하루 한 번) |

### 요청
```json
{"equipmentId": 2,
 "readings": [{"collected_at": "2026-10-24 10:00:10", "vibration": 980.1, "pressure": 1004.2, "temperature": 2.5,
               "current": 0.9, "flow": 36.9, "rpm": 37.3}, "... 시간 순서로 35줄 이상"],
 "now": "2026-10-24T10:06:00",          // 선택: 주면 최신 값이 너무 오래됐을 때 status=stale
 "baseline": {"med": [...], "mad": [...]}}   // 전광판만: /baseline/vms 결과
```
- 시각 열 이름: CCTV·펌프·전광판 `collected_at`, 수위 `observed_at`. 빈 값은 `null` (채우지 말 것)
- 수위는 `level_m` (m), 전광판은 `temperature_c, ambient_c, ripple_v, response_time_ms, error_count, bad_pixel_pct`

### 응답 (네 종류 같은 모양 = 팀원 형식, 값은 예시)
```json
{"equipment_id": 2, "status": "ok", "risk_score": 69.0, "risk_level": "주의", "health_index": 31.0,
 "suspected_cause": "vibration",
 "reasons": [{"항목": "진동 이상 정도", "센서": "진동센서", "현재": 410.4, "평소": 0.757,
              "설명": "진동센서 값이 평소 흔들림 대비 벗어난 정도가 평소보다 높아요 (평소 0.757배 → 지금 410.4배)", "영향도": 45}],
 "warnings": [], "anomaly_raw": 0.71,
 "sensors": [{"센서": "진동센서", "항목": "vibration", "현재": 412.3, "평소": 980.0, "벗어난정도": -410.4, "상태": "평소와 달라요"}]}
```
| 키 | 내용 |
|---|---|
| `status` | `ok` · `insufficient_history`(데이터 부족) · `insufficient_data`(최근 값이 비어 있음) · `stale`(최신 값이 오래됨) · `baseline_pending`(전광판 평소 값 없음). ok 가 아니면 점수를 만들지 않아요 |
| `risk_score` | 0~100. 고장 확률이 아니라 "평소와 다른 정도 = 점검 후보" |
| `risk_level` | 정상 0~39 · 주의 40~69 · 위험 70+ (팀원 코드 그대로라 '정상'이에요. DB `pm_level` 은 '안전'이라 **Spring 은 pm_threshold 로 다시 판정**하세요) |
| `health_index` | 건강도 = 100 - risk_score (팀원 결과에도 이것만 더했어요) |
| `reasons[]` | 평소 범위를 벗어난 특징, 큰 순서로 최대 3개 (평소 범위 안이면 비어 있어요) |
| `suspected_cause` | CCTV `comm`·`video` / 펌프 `vibration`·`pressure`·`temperature`·`current`·`flow`·`rpm` / 전광판 `thermal`·`power`·`comm`·`display` |
| `anomaly_type` | 수위만: 급변(스파이크·스텝) · 지속 이탈 · 노이즈 증가 · 추세 꺾임 · 드리프트 |
| `sensors` | 펌프만: 센서 6개 각각의 현재·평소·벗어난 정도·상태 |
| `features` | **이번 점수에 쓰인 특징값 전체 (3~5개)**. 점수가 정상이어도 채워요. 아래 "features 규격" |

## features 규격 (`pdm/featout.py`)
네 종류가 같은 모양이에요. Spring 은 `detail.features` 로 그대로 저장하고 화면의 특징 카드에 내려줘요.
```json
{"key": "vib_level", "label": "진동 이상 정도", "kind": "집계값", "value": 20.362, "unit": "배",
 "normal": {"median": 0.757, "low": 0.0, "high": 1.692}, "contribution": 39, "direction": "up"}
```
| 키 | 내용 |
|---|---|
| `kind` | 집계값(평균·최대·변동 등) / 변화량(추세·기울기) |
| `normal` | `median` 평소 값, `low`~`high` 정상 범위. high 를 넘으면(변화량은 low 아래도) 사유로 올라오는 지점이에요 |
| `contribution` | 영향도(%). 5개 합이 100. 나쁜 쪽으로 벗어난 만큼의 비율. 전부 평소 범위 안이면 벗어난 크기 비율 |
| `direction` | `up` 평소보다 큼 / `down` 작음 |
- 정상 범위 기준: CCTV·펌프·수위 = 모델 스케일러의 중앙값 ± 3 x IQR (사유 판정 z >= 3 과 같은 지점), 전광판 = 평소 중앙값 ± 2 x 흔들림 (팀원 사유 기준 |z| >= 2).
  장비별 첫 4주 베이스라인(mean/std)으로 바꾸는 건 아직 안 했어요 (팀원과 합의 필요).
- 팀원 코드(`pm_final`)는 고치지 않고, 같은 입력으로 특징값을 한 번 더 계산해요.

## Spring 연동 (조회 -> 계산 -> 점수 보내기)
켜면 서버가 뜰 때 백그라운드에서 돌아요 (`pdm/runner.py`, `pdm/spring_client.py`). 외부 라이브러리 없이 표준 라이브러리만 써요.

| 단계 | 하는 일 |
|---|---|
| 1. 백필 (켤 때 한 번) | **점수가 아직 없는 장비만** 지난 7일을 1시간 간격으로 계산해 `backfill=true` 로 보내요. Spring 은 저장만 하고 이벤트·알림은 안 만들어요. 가장 최근 시점은 일부러 빼서, 이어지는 실시간 점수가 위험진입·급상승 판단을 받게 해요. 이미 있는 시각은 Spring 이 건너뛰니 다시 해도 안전해요 (약 2분) |
| 2. 한 바퀴 (기본 10초 대기) | `GET /api/internal/pm/equipments` -> 센서가 새로 들어온 장비만 `GET /api/internal/pm/sensors` -> 계산 -> 새 점수·전송 실패한 최신 점수만 `POST /api/internal/pm-scores` (500건씩) |
| 전광판 평소 값 | 장비·날짜마다 한 번 37일치(1시간 간격)로 만들어 메모리에 캐시해요. 이력이 10일치가 안 되면 그 장비는 `baseline_pending` 으로 건너뛰어요 |
| 이상 시작 시각 | 점수가 주의(40) 이상이 이어진 시작 시각을 `detail.anomalyStartedAt` 으로 보내요 (메모리에서 추적. 백필이 채워 줘요) |

- 새 데이터가 없으면 재계산·재전송하지 않아요. 단, 엔진 연결 상태 유지를 위해 60초마다 캐시 1건을 heartbeat로 보내요 (같은 설비·시각은 Spring에서 중복 저장하지 않음).
- 전송 실패 시 장비별 최신 점수를 다음 바퀴에 재시도해요. 장비가 삭제되거나 센서 데이터가 사라지면 해당 캐시를 제거해요.
- 센서 생성 주기는 배수펌프 10초, 수위센서 5분, CCTV·전광판 1시간이에요. 10초 조회가 모든 종류의 센서 생성·재계산 주기를 바꾸는 것은 아니에요. 한 바퀴 실행 시간에 POLL_SEC 대기가 더해지므로 모든 10초 원본마다 점수를 하나씩 보장하지는 않아요.
- 센서 창은 **각 장비의 마지막 센서 시각(`lastSensorAt`)** 기준으로 잘라요. 지금 시각이 아니라서, 센서가 멈춰 있어도(백필만 있는 상태) 계산돼요. 센서가 끊겼는지(미수신)는 Spring 이 판단해요.
- 점수를 못 만드는 장비(`insufficient_history` · `baseline_pending` 등)는 보내지 않고 `/link/status` 에 사유만 남겨요.
- 보내는 모양: `{equipId, type, score, predictedAt, reasons[사유 문장 최대 3개], detail:{features[], anomalyStartedAt, extra{sensors, suspectedCause, anomalyType, reasonDetails}}, modelVersion}`

| API | 내용 |
|---|---|
| `GET /link/status` | 한 바퀴 횟수 · 마지막 시각 · 마지막 오류 · 장비별 상태 · 백필 진행 · 이상 시작 시각 |
| `POST /link/run-now` | 한 바퀴를 지금 돌려요 |
| `POST /link/backfill` | 지난 N일을 다시 채워요 (백그라운드) |
| `POST /link/reset` | 메모리 캐시를 비워요 (Spring 센서를 `reset=true` 로 다시 채운 뒤 부르세요) |

설정 (환경변수, `config.py`): `SPRING_URL`(기본 http://localhost:5555) · `INTERNAL_API_KEY`(Spring `puf.internal.api-key` 와 같은 값, **비어 있으면 연동이 꺼져요**) ·
`LINK_ENABLED`(1) · `POLL_SEC`(10) · `BACKFILL_ON_START`(1) · `BACKFILL_DAYS`(7) · `BACKFILL_STEP_MIN`(60) · `HTTP_TIMEOUT`(60).
키는 `run.bat` 에 쓰지 말고 `secret.bat` (git 에 올리지 않기) 에 `set INTERNAL_API_KEY=...` 로 적어 두세요.

## 점수 (네 종류 같은 눈금, `pdm/pm_final/pdm_common.py`)
| 점수 | 기준 |
|---|---|
| 0 / 20 / 40 | 정상의 1% / 중앙값 / 99% 지점 |
| 70 | 알림 기준: 검증 구간(깨끗한 정상)에서 헛알림 묶음이 예산 이하가 되는 가장 낮은 값 |
| 100 | 70점 기준 + (70점 기준 - 중앙값) |

70 이상이 되려면 **연속으로** 넘어야 해요: CCTV 3번(3시간) · 펌프 6번(1분) · 수위 2번(10분) · 전광판 3번(3시간).

## CCTV · 배수펌프 모델 (`train.py` 로 다시 학습, 각 5초)
팀원 수위·전광판과 같은 방식: 기간을 학습 / 검증 / 시험으로 나누고, 학습 구간 특징으로 RobustScaler + IsolationForest(200개, 비지도),
검증 구간으로 70점 기준, 처음 보는 시험 구간으로 채점.

| | CCTV | 배수펌프 |
|---|---|---|
| 센서 | 영상 수신률 · 응답 시간 · 패킷 손실률 · 화면 흐림 | 진동 · 압력 · 온도 · 전류 · 유량 · 회전수 (원본 sensor_23·28·00·13·42·45, **이름은 임의**) |
| 특징 | 수신률 평균 · 응답 시간 평균·증가 추세 · 패킷 손실 평균 · 흐림 최대 | 진동 이상 정도·변동성 · 압력 이상 정도 · 온도 변화 추세 · 평소 범위를 벗어난 센서 비율 |
| 기간 | 학습 1~2월 · 검증 3월 · 시험 4월 | 학습 6/21 · 검증 ~6/23 18시 · 시험 그 뒤 (6/28 22시 고장) |
| 헛알림 예산 | 설비·월 0.5건 | 검증 구간 0건 (펌프 1대뿐) |
| 시험 결과 | 고장 15건 모두 70점 이상, **중앙 12.3일 전**, 헛알림 설비·월 0.46건 | 고장 95.5시간 전 70점, 시험 정상 18시간에 헛알림 4건 |

- CCTV 고장 구간 = 고장 14일 전~고장 12시간 뒤 (샘플은 2~3주 전부터 나빠져요). 고장이 한 번도 없는 노후 장비(정비 후 120일)도 점수가 오르는데, 샘플에는 '정상'으로 표시돼 있어서 헛알림으로 세어져요
- 펌프 데이터는 1대 · 8일 · 고장 1건뿐이라 평가가 약해요. 시험 정상 구간에도 이미 온도가 내려가는 조짐이 있어요. 전류·유량·회전수는 고장 때도 거의 안 변해서(평소의 1.6배 이하) 근거에 잘 안 나와요
- 펌프 10초 데이터는 1분 원본 사이를 직선으로 잇고 평소 1분 변화량의 0.3배 잡음을 더한 **합성**이에요 (`pdm/samples.py`)
- 팀원 모델처럼 시각 간격을 맞추지(asfreq) 않고 '최근 N개'로 계산해요. 간격이 일정하면 결과는 같아요
- 모두 합성·샘플 데이터라 수치는 참고치예요. 실제 데이터가 쌓이면 같은 방법으로 다시 학습하세요

## 아직 정해지지 않은 것
- features 의 정상 범위(`normal`)를 모델 스케일러 기준으로 할지, 장비별 첫 4주 베이스라인(mean/std)으로 할지
- 수위 실제 데이터 간격 (5분이 아니면 팀원 모델 재학습 필요)
- 서버를 껐다 켤 때 `anomalyStartedAt` 은 백필로 다시 채워요 (백필을 끄면 켠 시점부터 새로 세요)

## OCR 서버가 느려지지 않게
`CPU_THREADS`(기본 1), `LOW_PRIORITY`(기본 1 = '보통 미만' 우선순위). 시연 중 계산이 밀리면 `set LOW_PRIORITY=0`.

## 이전 버전
시뮬레이터(가짜 센서 생성 → pm_sensor 저장 → Spring 전송)가 들어 있던 버전은 `D:\Final프로젝트\대비용\예지보전_시뮬레이터버전_백업\` 에 있어요.
팀원들의 원래 모델 폴더는 `D:\Final프로젝트\대비용\예지보전_원본모델_백업\`.

자동 점수 백필은 `lastScoreAt`이 있으면 건너뛰어요. `/link/status`의 `backfill.skippedExisting`에서 개수를 확인할 수 있어요.
일부 점수만 들어간 장비의 과거 구간을 다시 계산하려면 수동 `POST /link/backfill`을 사용해요. 센서 데이터는 지우지 않고, 같은 설비·시각의 점수도 덮어쓰지 않아요.
