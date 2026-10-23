# 팀 API 설정 및 연결 안내

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
| `AI_SERVER_URL` | 차량번호 인식 AI 서버 주소 | `/control/plate` 프록시 대상. 미설정 시 `http://localhost:8000` |
| `INTERNAL_API_KEY` | 내부 서버 간 인증키 | `/control/plate` 프록시의 `X-Internal-Api-Key`. 백엔드 `puf.internal.api-key` 및 AI 서버 설정과 일치 필요 |
| `VITE_DATA_MODE` | 키가 아닌 데이터 모드 | `server`: 백엔드 연동, `example`: 예시 데이터 |

`VITE_` 변수는 브라우저 코드에 포함됩니다. REST·기상청·ITS·내부 인증키에는 `VITE_`를 붙이지 마세요. `.env`와 `.env.local`은 현재 `.gitignore`에 등록되어 있습니다. 팀원은 키 소유자에게 별도로 키를 전달받아야 합니다.

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
