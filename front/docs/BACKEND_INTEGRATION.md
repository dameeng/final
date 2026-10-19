# PUF 백엔드 연결

기준: 제공된 `puf-backend-g.zip`의 Controller, DTO, enum, SecurityConfig와 `docs/API_변경사항.md`. 압축 파일의 설치·DB 초기화 명령은 실행하지 않았다. 백엔드 참조 소스는 `.backend-reference/`에만 있으며 Git에서 제외한다.

## 실행

백엔드가 `http://localhost:5555`에서 실행되어 있어야 한다. 프런트는 8282에서 실행한다.

```dotenv
BACKEND_URL=http://localhost:5555
VITE_DATA_MODE=server
```

`.env`를 변경한 다음 Vite를 재시작한다. `/api` 요청을 백엔드로 프록시하며, 기존 `/api/navigation/*` 중계는 유지한다. 운영 환경에서도 같은 경로의 프록시가 필요하다. 세션 쿠키는 `credentials: include`로 전송하며 별도 토큰을 만들어 로그인시키지 않는다.

예시 모드에서는 종합 현황의 고정 배치를 볼 수 있다. `/admin-login`에서 실제 로그인에 성공하면 해당 세션의 화면은 자동으로 서버 모드로 전환된다. `/index`의 운영 관리 및 사이드바에서도 새 관리 화면으로 이동할 수 있다.

## 고정 종합 현황

위젯 편집·추가·삭제·크기 조절·배치 저장은 제거했다. 상단 시설 요약, 왼쪽 최근 이벤트, 오른쪽 큰 지도, 하단 주요 현황의 고정 배치다. 작은 화면에서는 한 열로 배치한다. GridStack 의존성도 제거했다.

## 연결 범위

| 기능 | 프런트 | 백엔드 |
|---|---|---|
| 관리자 로그인·직원 확인·문자 인증·가입·비밀번호 재설정 | `/admin-login`, `/admin-signup`, `/admin-password-reset` | `/api/managers/login`, `/signup/**`, `/password-reset/**` |
| 관리자 본인 정보·비밀번호 변경·탈퇴 | `/admin-profile` (서버 모드) | `/api/managers/me`, `/me/password`, `/me/withdraw` |
| 관리자 담당 지역·근무조·탈퇴, 상태별 목록 | `/admin-data/managers`, `/shifts` | `/api/managers`, `/{id}/regions`, `/{id}/shift`, `/{id}/withdraw`, `/api/shifts` |
| 지역 조회·등록·수정·삭제 | `/admin-data/regions` | `/api/regions` |
| 시설 목록·상세·등록·수정·삭제 | `/fac-list`, `/admin-data/facilities` | `/api/underpasses` |
| 통제·해제, 소방 이관, 경찰 PDF, 재다운로드 | 시설 작업 및 `/admin-data/transfers` | `/api/control/underpasses/{id}/block`, `/release`, `/fire-transfer`, `/transfers`, `/api/control/transfers/{id}/pdf` |
| 통제 사유·전광판 문구 프리셋 | `/admin-data/reasons`, `/presets` | `/api/control/reason-presets`, `/api/display/presets` |
| 카메라 등록·수정·삭제·영상 보기, 입출구 카메라 지정 | `/admin-data/cameras`, 시설 작업 | `/api/underpasses/{id}/cameras`, `/{id}/gate-cameras` |
| 위험 임계치 조회·단계별 저장 | `/admin-data/thresholds` | `/api/underpasses/{id}/thresholds`, `/{level}` |
| 전광판 페이지 등록·수정·삭제 | `/admin-data/display` | `/api/display/equipments/{equipId}/pages`, `/{pageNo}` |
| 차량 통과·잔류 기록, 번호 검색·기간·상태·페이지 | `/admin-data/transits` | `/api/underpasses/transits` |
| 번호판 판별·정정, 캡처 이미지 | `/verify`, `/admin-data/reviews` | `/api/plate-logs?reviewStatus=PENDING`, `/{id}/review`, `/api/uploads/**` |
| 제어 이력·개별 시설 위험 관측 기록 | `/admin-data/events`, `/risk-history` | `/api/underpasses/{id}/events`, `/{id}/risk-scores` |
| 대시보드 12종 KPI·통계·위험도 추이 | `/admin-dashboard`, `/admin-reports` | `/api/dashboard/**` |
| 공지·FAQ 목록·상세·등록·수정·삭제 | `/admin-data/notices`, `/faqs`, 고객 공지·FAQ | `/api/notices`, `/api/faqs` |
| 고객 문의 조회, 답변 등록·수정·삭제 | `/admin-data/inquiries` | `/api/inquiries`, `/{id}/reply` |
| 고객 검색·정보 수정·탈퇴 | `/admin-data/customers` | `/api/customers`, `/{id}`, `/{id}/withdraw` |
| 고객 로그인·문자 인증·가입·비밀번호 재설정 | `/login`, `/signup`, `/password-reset`, 고객 앱 로그인 | `/api/customers/login`, `/phone-code/**`, `/signup`, `/password-reset/**` |
| 내 정보·비밀번호·탈퇴·등록 알림 기기 조회 | `/my-home`, `/my-account`, 고객 앱 계정 화면 | `/api/customers/me`, `/me/password`, `/me/withdraw`, `/me/device-tokens` |
| 내 차량 등록·수정·삭제, 문의 작성·상세, 내 알림 | `/my-cars`, `/my-inquiries`, `/my-alerts`, 대응 고객 앱 메뉴 | `/api/customers/me/cars`, `/inquiries`, `/alerts` |
| 알림 발송 검색 | `/notifications`, `/admin-data/alerts` | `/api/alert-logs` |
| 공개 시설 지도·현재 상태·날씨 | 고객 웹·앱 지도 | `/api/underpasses`, `/api/weather` |

기존 경로의 새 연결은 서버 모드에서 활성화된다. `/admin-data/*`, 새 인증 화면, 통계 화면은 항상 실제 API를 호출한다. 관리자 앱 로그인·현황·통제·알림·내 정보도 같은 서비스에 연결한다. 서버 모드에서는 입력 오류, 인증 만료, 담당 범위 403, 타임아웃을 표시하고 실패한 수정 입력을 유지한다.

## 변경된 계약 반영

- 모든 페이지 목록은 `data.items`, `page`, `size`, `totalItems`, `totalPages`로 처리하며 페이지는 1부터 시작한다. 배열 응답(지역·카메라·임계치·차량·그래프)도 구분한다.
- 판별대기는 삭제된 `/plate-logs/pending` 대신 `/plate-logs?reviewStatus=PENDING`을 사용한다.
- 잔류 차량은 삭제된 시설별 `/transits` 대신 `/underpasses/transits?underpassId=...&status=REMAINING`을 사용한다.
- 차량 검색은 `keyword`가 아닌 `carNum`으로 보낸다. 기간은 `startDate`, `endDate`이며 시작일이 더 늦으면 요청하지 않는다.
- 실제 enum을 사용한다: 카메라 `CCTV/APPROACH_LPR/FINAL_LPR`, 통과 `IN_TRANSIT/EXITED/REMAINING`, 알림 `PREDICTIVE/FINAL`, 관리자 상태 `PENDING/ACTIVE/WITHDRAWN`.
- 시설 목록은 이름·위험 점수·최근 등록 정렬 및 `NORMAL/BLOCKED` 필터를 지원한다.
- 통제·이관의 PDF 응답은 JSON 성공으로 간주하지 않고 `application/pdf`를 확인한 후 파일로 받는다.
- 관리자 이름·지역·근무조는 실제 관리자 조회 응답을 기준으로 표시한다. 본인이 수정할 수 있는 것은 DTO에서 허용한 전화번호·이메일이며 담당 지역·근무조는 별도 관리 화면에서 변경한다.

## 백엔드 추가 또는 외부 서비스가 필요한 부분

- 이 파일에 **설비 점검 대기·점검 이력 저장·예지보전 모델 설명·챗봇·실제 근무 인수인계 조회 API는 없다**. 해당 화면의 예시를 실제 저장 성공으로 바꾸지 않는다. 인수인계 팝업에도 예시임을 표시한다.
- 관리자 가입 상태는 조회할 수 있으나 **승인·거절 endpoint는 없다**. 없는 주소로 승인 작업을 보내지 않는다.
- 푸시 기기 등록/해제 API는 토큰을 요구한다. 브라우저용 VAPID/FCM 설정 또는 네이티브 앱 토큰 발급 연결은 제공되지 않아, 임의 토큰을 생성하거나 푸시 발송이 성공했다고 표시하지 않는다. 계정 화면은 서버에 등록된 기기 상태를 조회한다.
- FastAPI의 위험도/번호판 업로드, 내부 키 인증, 개발용 SMS 코드 노출 API는 서비스 간 API이며 사용자 브라우저에 노출하지 않는다.
- 관리자 고객 수정 API는 주소 등도 통째로 교체하지만 고객 목록에는 기존 주소·비상 연락처가 없다. 해당 교체에 대한 확인을 받는다. 기존 값을 안전하게 유지하는 수정을 위해서는 고객 상세 조회 또는 PATCH API 추가가 바람직하다.

## 검증

`npm.cmd run typecheck`, `npm.cmd run build`, `npm.cmd test`를 사용한다. 테스트는 고정 배치, 탭 위치, 팝업, 모바일과 제공된 계약을 재현한 API 응답을 검사한다. 실제 Spring Boot/DB·문자 발송·장비 제어 검증은 실행 중인 백엔드 및 인증 계정이 필요하다. DB 초기화나 실제 장비 제어 요청은 실행하지 않았다.
