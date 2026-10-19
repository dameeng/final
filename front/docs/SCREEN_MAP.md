# 원본 화면 대응과 변경

원본 38개 파일을 모두 브라우저에서 열었습니다. 모달은 표시 상태로 렌더링해 양식을 확인했고, 실제 링크 탭도 전환했습니다. 앱 28개 프레임을 개별 확인했습니다.

| 원본 파일 | Vue 파일·경로 | 처리 | 원본 SHA-256 |
|---|---|---|---|
| my-home.html | src/pages/my-home.vue · /my-home | 원본 DOM·표·입력·그래프·상세 흐름 유지, 제작문구 제거, CSS 분리 | 1c0904fd4e0391be |
| shift-login.html | src/pages/shift-login.vue · /shift-login | 원본 인수인계 팝업 유지. X·닫기·리포트연결 | 648ea69ed2430941 |
| staff.html | 직원 관리 화면 제거 | 회의 결정으로 전용 UI 제외; `/staff`는 `/admin-dashboard`로 연결 | 2f49b258e24ca483 |
| fac-list.html | src/pages/fac-list.vue · /fac-list | 원본 DOM·표·입력·그래프·상세 흐름 유지, 제작문구 제거, CSS 분리 | e4fa679f710a662c |
| bot-unanswered.html | src/pages/bot-logs.vue · /bot-logs | 별도 화면 제거. 대화 로그 상태 필터와 FAQ 등록으로 통합 | dac7c086827cc4f7 |
| verify.html | src/pages/verify.vue · /verify | 미인식·미수신 탭·표 제거. 대기·이력·판별 유지 | bebc9ebc8ba8ddeb |
| my-cars.html | src/pages/my-cars.vue · /my-cars | 원본 DOM·표·입력·그래프·상세 흐름 유지, 제작문구 제거, CSS 분리 | 23c41602e533b5ec |
| c-auth.html | src/pages/c-auth.vue · /c-auth | 원본 필드 전부 유지, 3개 인증 화면 전환. 전화번호 분할입력 | 8879ce185d0f389a |
| c-app-screens.html | src/pages/customer-app-1~14.vue · /customer-app/screen-1~14 | 14개 구성 → 고객앱 screen-1~14. 5번에 날씨 탭 통합 | c3be26508f27027f |
| my-inquiries.html | src/pages/my-inquiries.vue · /my-inquiries | 원본 DOM·표·입력·그래프·상세 흐름 유지, 제작문구 제거, CSS 분리 | 1f016acadf44ce05 |
| cs-notice-edit.html | src/pages/cs-notice-edit.vue · /cs-notice-edit | 원본 DOM·표·입력·그래프·상세 흐름 유지, 제작문구 제거, CSS 분리 | 9a97c4ae9799dc3e |
| bot-logs.html | src/pages/bot-logs.vue · /bot-logs | 전체 대화·결과·상세 유지. 상세 FAQ 등록·FAQ관리 연결 | bd64e1a171724e1f |
| pm-history.html | src/pages/pm-history.vue · /pm-history | 원본 DOM·표·입력·그래프·상세 흐름 유지, 제작문구 제거, CSS 분리 | 314b13cc5ad6ca2c |
| pm-queue.html | src/pages/pm-queue.vue · /pm-queue | 원본 DOM·표·입력·그래프·상세 흐름 유지, 제작문구 제거, CSS 분리 | 9d593ed685f328f4 |
| admin-dashboard.html | src/pages/admin-dashboard.vue · /admin-dashboard | 지도·선택시설 내용 유지, 그리드 위젯으로 이동. 기본5개 + 수신·최근이벤트 추가목록 | 3cf8fd571acac123 |
| index.html | src/pages/index.vue · /index | 원본 DOM·표·입력·그래프·상세 흐름 유지, 제작문구 제거, CSS 분리 | 1ba136c9dcfbd26f |
| logs.html | src/pages/logs.vue · /logs | 원본 분류·기간·시설필터·표·서랍 유지, TSV내보내기 | 44753b05c8220eb0 |
| notifications.html | src/pages/notifications.vue · /notifications | 원본 DOM·표·입력·그래프·상세 흐름 유지, 제작문구 제거, CSS 분리 | 97247d5d92098324 |
| bot-stats.html | src/pages/bot-stats.vue · /bot-stats | 원본 DOM·표·입력·그래프·상세 흐름 유지, 제작문구 제거, CSS 분리 | f0814f0c3da9003c |
| c-notice.html | src/pages/c-notice.vue · /c-notice | 원본분류·공지표·FAQ 유지, 검색·탭·펼침 | c3eccf8ddd5a8548 |
| fac-new.html | src/pages/fac-new.vue · /fac-new | 설비 등록 표 제거(예지보전으로 분리). 초기설정·주소·좌표·지도 유지 | c364ce99f1877197 |
| cs-inquiry-detail.html | src/pages/cs-inquiry-detail.vue · /cs-inquiry-detail | 원본 DOM·표·입력·그래프·상세 흐름 유지, 제작문구 제거, CSS 분리 | e2fc24a07cad94af |
| c-map.html | src/pages/c-map.vue · /c-map | 원본 목록과 상세를 같은영역에서 교체. 지도 빈 열 제거. 묶음 목록 추가 | 6a674fc5d75c242b |
| m-app-screens.html | src/pages/admin-app-1~14.vue · /admin-app/screen-1~14 | 14개 구성 → 관리자앱 screen-1~14. 요청한 제거·추가 적용 | cb928b8c00a5e26b |
| my-alerts.html | src/pages/my-alerts.vue · /my-alerts | 원본 DOM·표·입력·그래프·상세 흐름 유지, 제작문구 제거, CSS 분리 | 13e47b0ff35bd493 |
| cs-customer-detail.html | src/pages/cs-customer-detail.vue · /cs-customer-detail | 원본 DOM·표·입력·그래프·상세 흐름 유지, 제작문구 제거, CSS 분리 | b4d552cc816bebfc |
| handover-pdf.html | src/pages/handover-pdf.vue · /handover-pdf | 원본 경찰·소방 통제전달서 유지. 출력 버튼 연결 | 65c32f330dcbf3a7 |
| cs-customers.html | src/pages/cs-customers.vue · /cs-customers | 원본 DOM·표·입력·그래프·상세 흐름 유지, 제작문구 제거, CSS 분리 | c6ae811ece88003d |
| my-inquiry-new.html | src/pages/my-inquiry-new.vue · /my-inquiry-new | 원본 DOM·표·입력·그래프·상세 흐름 유지, 제작문구 제거, CSS 분리 | fba85a56fed8a172 |
| pm-settings.html | src/pages/pm-settings.vue · /pm-settings | 지표·기준·가중치·경계·미리보기·이력 유지 | b27cd144e1f0f612 |
| my-withdraw.html | src/pages/my-withdraw.vue · /my-withdraw | 원본 DOM·표·입력·그래프·상세 흐름 유지, 제작문구 제거, CSS 분리 | 6be308a689e8ee4e |
| pm-equipment-detail.html | src/pages/pm-equipment-detail.vue · /pm-equipment-detail | 원본 DOM·표·입력·그래프·상세 흐름 유지, 제작문구 제거, CSS 분리 | 023fc3736521176a |
| cs-inquiries.html | src/pages/cs-inquiries.vue · /cs-inquiries | 원본 DOM·표·입력·그래프·상세 흐름 유지, 제작문구 제거, CSS 분리 | 13c2a4df2d07a640 |
| c-app.html | src/pages/c-app.vue · /c-app | 원본 DOM·표·입력·그래프·상세 흐름 유지, 제작문구 제거, CSS 분리 | 32c4ee0bc6461e04 |
| my-account.html | src/pages/my-account.vue · /my-account | 원본 DOM·표·입력·그래프·상세 흐름 유지, 제작문구 제거, CSS 분리 | 2cc9b3ca1f50dd00 |
| fac-detail.html | src/pages/fac-detail.vue · /fac-detail | 수신표를 시설명 옆으로 이동. CCTV 영상+기록 두영역. 스냅샷은 접이식 보존 | 9d6e0d7b8f590f82 |
| pm-equipment.html | src/pages/pm-equipment.vue · /pm-equipment | 원본7개표열·서랍 유지, 시설필터와 설비추가 | 4dd639dfcd19a498 |
| cs-content.html | src/pages/cs-content.vue · /cs-content | 원본 DOM·표·입력·그래프·상세 흐름 유지, 제작문구 제거, CSS 분리 | 9d432947e4418894 |

## 누락 점검
실행 화면의 표 수를 원본과 대조했습니다. 요청에 따라 제거된 표는 fac-new의 설비 등록 표와 verify의 미인식·미수신 표입니다. 그 외 보존 대상 웹 화면의 표 수가 원본과 일치했습니다. CSS 위치 오류는 수정했고, 숨긴 요소 자리의 공백을 없앴습니다.

## 구현 한계
모바일의 일부 원본 버튼은 원본처럼 예시 화면간 전환을 제공합니다. 실제 가입·전화인증·길찾기·영상·직원 승인·외부 전송 API는 제공되지 않아 실제 처리로 연결되어 있지 않습니다. 모든 버튼의 서버 작업을 구현한 제품은 아닙니다. 정확한 서버 규격이 필요한 항목은 README를 참조하세요.

## 별도 추가
shift-report.vue는 근무 인수인계 리포트입니다. 경찰·소방 전달 문서 handover-pdf.vue와 구분했습니다.
