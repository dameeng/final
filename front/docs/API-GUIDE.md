# 팀 API 설정 및 연결 안내

## ROUTEL AI 도우미 설정

기존 고객 웹·앱 챗봇은 `/api/assistant/chat`을 통해 기본적으로 **Gemini**에 연결합니다. `.env.local`에 다음 서버 전용 항목을 넣고 Vite를 재시작하세요. 키는 채팅에 보내거나 Git에 올리지 않습니다.

```dotenv
CHAT_AI_PROVIDER=gemini
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.5-flash-lite
```

### Gemini 키 넣는 순서

1. [Google AI Studio API 키 페이지](https://aistudio.google.com/apikey)에 Google 계정으로 로그인하고 안내된 약관에 동의합니다.
2. **API 키 만들기 / Create API key**를 누르고 새 프로젝트를 만들거나 사용할 프로젝트를 선택합니다. **무료로 사용할 때는 해당 프로젝트의 요금제가 Free Tier인지 확인하고 결제 설정을 연결하지 않습니다.** 계정·지역·프로젝트에 따라 무료 티어 이용 자격이 제한될 수 있습니다.
3. 발급된 키 전체를 복사하여 `.env.local`의 `GEMINI_API_KEY=` 뒤에 붙여넣고 저장합니다. `.env.example`에는 실제 키를 넣지 않습니다. 기존 OpenAI 키는 Gemini 키로 사용할 수 없습니다.
4. 프론트 터미널에서 `Ctrl+C` 후 `npm.cmd run dev`로 다시 실행합니다.
5. 챗봇에 짧은 질문을 보내 확인합니다. 429 오류가 나면 AI Studio에서 모델별 할당량을 확인합니다. 무료 사용량은 고정된 질문 횟수가 아니며 계정별 실제 할당량이 기준입니다.

`gemini-3.5-flash-lite`는 확인일(2026-10-26) 공식 요금표에 입력·출력 무료 티어가 안내된 모델입니다. **동일 모델도 유료 프로젝트의 키를 사용하면 과금될 수 있습니다.** 무료 티어 입력 내용이 Google 제품 개선에 사용될 수 있으므로 개인정보를 입력하지 않습니다. Gemini 오류·키 누락·사용량 초과 시 OpenAI나 다른 유료 서비스로 자동 전환하지 않습니다. 앱 코드는 Google 계정의 요금제 자체를 변경하거나 무료 자격을 보장할 수 없습니다.

OpenAI를 다시 사용하려면 `CHAT_AI_PROVIDER=openai`를 직접 설정하고 기존 `OPENAI_API_KEY`, `OPENAI_MODEL`을 사용합니다. 기존 키는 로컬 파일에 보존하며, Gemini 선택 시 OpenAI로 보내지 않습니다. 실제 키가 없으면 챗봇에는 연결 준비 안내가 표시됩니다. 두 제공사 모두 서버 전용 키에 `VITE_`를 붙이면 안 됩니다.

`server/chat-api.mjs`는 공개 FAQ 목록·상세와 시설의 이름·지역·통제·위험 단계만 참고자료로 전달합니다. 서버가 공개 정보를 조회하지 못하면 해당 최신 상태를 아는 것으로 답하지 않도록 지시합니다. 로그인 쿠키, 계정·차량·문의 기록, 비밀 설정은 모델에 전달하지 않습니다. 질문과 최근 최대 9개 대화 항목은 답변 생성 목적으로 전송됩니다. OpenAI 경로에만 `store:false`를 사용하며 Gemini의 데이터 처리는 Google의 요금제·약관에 따릅니다. 입력은 항목당 2,000자, 출력은 최대 600토큰(제공사별 사고 토큰 포함 여부가 다름)으로 제한하고 IP별 분당 15회 제한을 적용합니다. AI 답변은 현장 통제 판단의 근거로 사용하지 말고 현황 화면·공식 안내를 확인하세요.

개발 서버와 `vite preview`에 모두 중계가 등록됩니다. **`dist` 파일만 정적 호스팅하면 AI 중계가 실행되지 않습니다.** 배포 시에도 Node/Vite 미들웨어를 실행하거나 같은 `/api/assistant/chat` 경로를 별도 서버로 옮겨 연결해야 합니다. API 키는 그 서버에만 설정합니다.

구현 기준: [Gemini API 키 안내](https://ai.google.dev/gemini-api/docs/api-key), [Gemini 생성 API](https://ai.google.dev/api/generate-content), [Gemini 요금표](https://ai.google.dev/gemini-api/docs/pricing), [모델 안내](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite). OpenAI 경로는 [공식 Responses API 안내](https://developers.openai.com/api/docs/guides/migrate-to-responses)를 따릅니다. 실제 AI 응답은 API 키와 해당 계정의 모델 접근·사용 한도가 준비된 뒤 확인할 수 있습니다.

기준일: 2026-10-23.

## 키와 주소 설정

실제 키 값은 로컬 `.env.local`에 입력하고, 팀 공유 양식은 `.env.example`을 사용합니다. `.env`와 `.env.local`은 함께 읽으며 같은 항목은 `.env.local`이 우선합니다. 파일 수정 후 개발 서버를 재시작하세요. 실제 비밀 키는 문서에 복사하지 않습니다.

| 설정 이름 | 어떤 값인가요? | 사용처 |
| --- | --- | --- |
| `VITE_KAKAO_MAP_KEY` | 카카오 앱의 JavaScript 키 | 지도 표시, 지도 SDK 장소·주소 검색. 허용 도메인에 실제 접속 주소(기본 `http://localhost:8282`) 등록 |
| `KAKAO_REST_API_KEY` | 카카오 앱의 REST API 키 | 자동차 길찾기와 장소 검색. 현재 본인 키는 `.env.local`에 설정되어 있고 기존 팀원 키는 `.env`에서 제거됨 |
| `KMA_SERVICE_KEY` | 공공데이터포털 기상청 단기예보 서비스 인증키 | 초단기실황의 기온·습도·강수·풍속 조회 |
| `ITS_API_KEY` | 국가교통정보센터 ITS 인증키 | 별도로 구현된 ITS 도로 CCTV 중계용. 현재 부산 CCTV 화면에는 사용하지 않음 |
| `BACKEND_URL` | Spring Boot 백엔드 주소 | 일반 `/api` 요청 전달. 미설정 시 `http://localhost:5555` |
| `VITE_DATA_MODE` | 키가 아닌 데이터 모드 | `server`: 백엔드 연동, `example`: 예시 데이터 |

`VITE_` 변수는 브라우저 코드에 포함됩니다. REST·기상청·ITS 키에는 `VITE_`를 붙이지 마세요. `.env`와 `.env.local`은 현재 `.gitignore`에 등록되어 있습니다. 팀원은 키 소유자에게 별도로 키를 전달받아야 합니다.

## 외부 API와 CCTV 연결

| 구분 | 프론트가 요청하는 경로 | 실제 대상 및 관련 파일 | 별도 키 |
| --- | --- | --- | --- |
| 카카오 지도 | 카카오 지도 SDK 로딩 | `https://dapi.kakao.com/v2/maps/sdk.js`, `src/services/kakao.ts` | JavaScript 키 |
| 카카오 장소 검색 | `/api/navigation/places` | `https://dapi.kakao.com/v2/local/search/keyword.json`, `server/navigation-api.mjs` | REST API 키 |
| 자동차 길찾기 | `/api/navigation/directions` | `https://apis-navi.kakaomobility.com/v1/directions`, `src/services/navigation.ts`, `server/navigation-api.mjs` | REST API 키 |
| 기상청 날씨 | `/api/navigation/weather` | `https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst`, `src/services/weather.ts`, `server/navigation-api.mjs` | 기상청 키 |
| 부산 도로 CCTV 목록 | `/map-cctv.json` | **현재는 로컬 정적 목록** `public/map-cctv.json`을 `src/services/busanCctv.ts`가 읽음 | 없음 |
| 부산 도로 CCTV 영상 | 목록에 저장된 영상 URL | 부산 `its-stream*.busan.go.kr` HLS 스트림, `src/components/TrafficVideo.vue`에서 재생 | 현재 코드에 별도 키 없음 |
| ITS 도로 CCTV 중계 | `/api/navigation/cctv` | `https://openapi.its.go.kr:9443/cctvInfo`, `server/navigation-api.mjs` | ITS 키 |
| 시설 CCTV·번호판 인식 | `/api/cctv/{id}/stream`, `/api/cctv/plate/start`, `/api/cctv/plate/stop` | Spring 백엔드를 통한 시설 영상·AI 제어. `src/components/FacilityCctvViewer.vue` | 로그인 쿠키; 부산 도로 CCTV와 별개 |
| 우편번호 검색 | 우편번호 SDK 로딩 | `https://t1.kakaocdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js`, `src/services/postcode.ts` | 현재 코드에 별도 키 없음 |
| 신월여의지하도로 공개 CCTV | `/tunnel-source/getCctv-data.do`, `/tunnel-source/getCctvInfo-data.do` | `vite.config.ts`의 서울터널 중계와 `src/services/seoulTunnelCctv.ts`를 통해 목록·선택 영상 조회 | 없음 |

### 부산 CCTV의 현재 동작

과거 README에 적힌 부산 목록 API는 `https://its.busan.go.kr/api-n/v1/bsits/user/cctvs`입니다. **현재 `busanCctv.ts`는 이 API를 직접 호출하지 않습니다.** 정적 JSON을 읽기 때문에 새 카메라나 변경된 영상 주소가 자동으로 목록에 반영되지 않습니다. 목록 파일의 생성·갱신 경로는 현재 확인되지 않았습니다.

목록은 메모리에 1분 캐시하고 목적지·선택 시설 반경 5km 안의 카메라를 거리순으로 최대 15개 표시합니다. JSON이 로컬이어도 영상 자체는 외부 부산 서버에서 가져옵니다. `ITS_API_KEY`는 이 부산 목록·영상 연결에 사용하지 않습니다.

길찾기 화면 `CustomerDirections.vue`도 현재 `getNearbyBusanCctvs()`를 사용합니다. ITS 중계 API가 구현되어 있다는 이유로 이 화면이 ITS API를 호출하는 것은 아닙니다.

### 신월여의지하도로 공개 CCTV

관리자 시설 상세의 **내부 CCTV 보기**는 [서울터널 공식 교통정보](https://seoultunnel.co.kr/usage/traffic.do)의 신월여의지하도로 공개 CCTV를 별도 창에 표시합니다. 선택한 부산 시설의 자체 카메라와 다른 영상이므로 화면에 출처와 시설 구분을 표시하며, 기존 시설 CCTV·OCR 화면은 그대로 유지합니다.

공식 페이지와 같은 조회 전용 POST 요청을 사용합니다. 목록은 `lvl=1`, 영상 정보는 선택한 `cctvId`로 조회하고, 공식 플레이어와 같은 HTTPS HLS 주소로 재생합니다. 선택한 영상만 재생하며 창을 닫거나 카메라를 바꾸면 이전 재생을 정리합니다. 영상 연결 실패 시 다시 연결과 공식 사이트 링크를 제공합니다. 별도 인증키나 환경변수 추가는 필요하지 않습니다. 배포 환경에서도 기존 `/tunnel-source/*` 경로를 서울터널 `/usage/*`로 중계해야 합니다.

## 팀원 실행 순서

1. 처음 설정하는 PC에서는 `.env.example`을 `.env.local`로 복사합니다. 기존 `.env.local`이 있다면 덮어쓰지 말고 필요한 항목만 수정합니다.
2. 위 표에 따라 전달받은 키와 서버 주소를 입력합니다. 빈 값도 기존 `.env` 값을 덮어쓰므로, 사용하지 않을 빈 항목은 필요에 따라 제거합니다.
3. 카카오 JavaScript 키에 실제 접속 도메인과 포트를 등록합니다.
4. `npm.cmd run dev`로 실행합니다. 기본 접속 주소는 `http://localhost:8282`입니다.
5. 운영에서는 `/api/navigation/*` 중계와 일반 `/api` 백엔드 연결이 필요합니다. 정적 `dist` 파일만 배포하면 Vite 중계 코드는 실행되지 않습니다.

## 파일 위치

### 내비게이션 시연 주행

`/customer-app/screen-7`에서 경로를 검색한 다음, 주행 방식을 `시연 주행`으로 바꾸고 `안내 시작`을 누릅니다. 실제 카카오 경로를 따라 가상 위치가 이동하며 1·2·4·8·16배속을 선택할 수 있습니다. 1배속은 시속 50km 기준이고, 주행 중에도 배속 변경과 일시정지·재개가 가능합니다. 안내 종료·경로 변경·화면 이탈 시 시연을 중단합니다. `실제 GPS 안내`를 선택하면 기존 위치 권한 기반 안내를 사용합니다.

배속은 경로 위 가상 위치의 이동 속도를 바꿉니다. 카카오 API 응답 속도나 CCTV 영상 재생 속도를 바꾸는 설정은 아닙니다. 시연 자체의 추가 API 키는 필요하지 않으며 경로 조회에는 기존 카카오 REST 키를 사용합니다.

첨부 `navi_demo.zip`의 주행 방식을 현재 Vue 화면에 적용했습니다. ZIP의 별도 Java 서버에 있는 위험 발동·해제, SSE 동기화 및 자동 우회 서비스는 이번 시연 주행 통합 범위에 포함되지 않습니다. 수동 회피 지점 지정 기능은 화면에서 제거했습니다.

- `.env.example`: 공유 가능한 키 없는 설정 양식
- `.env.local`: 개인 PC의 키 및 서버 주소
- `vite.config.ts`: 백엔드·AI·서울터널 프록시
- `server/navigation-api.mjs`: 카카오·기상청·ITS 서버 중계
- `src/services/`: 기능별 요청 코드
- `public/map-cctv.json`: 현재 부산 CCTV 목록
- `src/components/FacilityCctvViewer.vue`: 시설 CCTV 스트림 및 번호판 인식 실행·정지

API 문서: [카카오모빌리티](https://developers.kakaomobility.com/guide/navi-api/directions), [기상청](https://www.data.go.kr/data/15084084/openapi.do), [ITS](https://www.its.go.kr/opendata/opendataList?service=cctv). 위 연결 현황은 외부 문서가 아닌 저장소 코드 기준입니다.
# 챗봇 대화 로그와 통계

기존 Spring 백엔드와 DB는 변경하지 않습니다. Vite의 서버 전용 AI 연결 모듈이 질문·답변과 성공/실패 결과를 `front/.routel-data/chat-turns.jsonl`에 저장합니다. 서버를 재시작해도 기록은 유지됩니다. 이 폴더는 Git 업로드와 Vite 파일 제공에서 제외하며, 운영 시 별도로 백업해야 합니다.

- 관리자 대화 로그: `/bot-logs` — 질문·답변 검색, 결과 필터, 10개씩 페이지 이동, 세션별 대화 상세.
- 관리자 통계: `/bot-stats` — 한국 시간 기준 오늘/최근 7일/최근 30일의 질문 수, 답변 성공률, 실패 질문 수, 세션 수, 일별 집계와 질문 순위.
- 조회 API: `GET /api/assistant/admin/logs`, `GET /api/assistant/admin/logs/{id}`, `GET /api/assistant/admin/stats?days=7`.
- 기존 `/api/managers/me`로 관리자 세션을 검증합니다. 고객·비회원은 로그를 조회할 수 없습니다. 사용자 이름·이메일·쿠키·API 키·IP 주소는 별도 수집하지 않고 대화 세션 식별자로 구분합니다. 본문에 포함된 이메일·한국 휴대전화 번호·일반적인 API 키 패턴은 저장 전에 가립니다. 모든 개인정보를 자동 식별하는 것은 아니므로 개인정보 입력 금지 안내도 유지합니다.
- 로그 저장은 이 기능을 적용한 이후 서버에 전달된 질문부터 시작합니다. 기존 브라우저 대화와 예시 데이터는 자동으로 가져오지 않습니다. 프론트에서 개인정보 질문으로 분류해 AI 요청 없이 안내한 메시지는 서버 로그에 포함되지 않습니다.

저장은 현재 Node/Vite 서버 인스턴스의 파일을 기준으로 합니다. 정적 `dist` 파일만 호스팅하면 AI 연결과 로그 API는 실행되지 않습니다. 다중 서버 운영 시에는 이 모듈에 공용 DB 저장소를 연결해야 합니다. 응답 성공률은 AI 서버에서 답변이 돌아왔는지의 비율이며, 답변의 정확도를 평가한 수치는 아닙니다. FAQ 등록 수는 연결 근거가 없어 예시 숫자를 제거하고 실제 대화 세션 수로 표시합니다.
# 번호판 수동 판별 기준

새 번호판 결과가 같은 카메라의 이전 인식 100건 평균 신뢰도보다 낮으면 수동 판별 대기로 분류합니다. 평균은 이번 결과를 저장하기 전에 조회하며, OCR 실패와 유효 범위 밖 점수는 제외합니다. 평균 자료가 없거나 평균이 60%보다 낮으면 기존 60% 기준을 사용합니다. 평균과 같은 점수는 대기 대상이 아닙니다.

번호판 원문·신뢰도·인식 상태와 기존 DB 기록은 변경하지 않습니다. 판별 대기의 기존 1분 마감도 유지합니다. 백엔드를 다시 시작한 뒤 들어오는 새 결과부터 적용됩니다. 기존 고정 기준으로 돌아가려면 **백엔드 실행 환경**에서 `OCR_REVIEW_RELATIVE_TO_AVERAGE=false`로 설정하고 재시작하세요. 프론트의 `.env.local` 설정은 백엔드에 적용되지 않습니다.
