# ROUTEL 기업 서비스 디자인 적용 기록

검토 자료: `ROUTEL_CSS_레퍼런스_50선_디자인_2안.pdf` (62쪽).
PDF는 초기 기획 자료이므로 현재 사용자 요청을 우선한다. PDF의 탭 구성, 위젯 슬롯, 화면 분할, 헤더 높이, 메뉴 이동 및 신규 기능 제안은 적용하지 않는다.

## 추가로 확인한 실제 기업 사이트

2026-10-23 공식 사이트를 브라우저에서 직접 열어 화면 표현을 확인했다.

| 사이트 | ROUTEL에 참고한 표현 |
| --- | --- |
| [Samotics SAM4](https://samotics.com/sam4) — 설비 상태 모니터링 | 짙은 브랜드 영역과 밝은 콘텐츠 영역의 대비, 명료한 제목 위계 |
| [Samsara Public Sector](https://www.samsara.com/industries/public-sector) — 공공 운영·안전 | 절제된 표면, 진한 제목, 명확한 행동 버튼 |
| [TomTom Traffic Stats](https://www.tomtom.com/products/traffic-stats/) — 교통 데이터 분석 | 교통 서비스의 신뢰감, 강조색의 일관성, 선택 메뉴의 구분 |

각 사이트의 페이지 배치와 기능은 가져오지 않았다. ROUTEL의 기존 위치와 기능을 유지하면서 남색·파란색, 흰 카드, 회청색 보조 표면으로 재해석했다. 사이트의 사진·로고는 복사하지 않았다.

## 앞서 PDF에서 확인한 표현

| 참고 | 적용 |
| --- | --- |
| 19 waterAX, 55·61쪽 A안 | 밝은 회청색 배경, 흰 카드, 파란 강조, 옅은 구분선 |
| 10 침수 관제, 55·61쪽 B안 | 기존 다크 모드에 남색 표면과 충분한 텍스트 대비 |
| 07 TomTom, 35 MaintainX | 표 헤더와 내용의 대비, 은은한 교차 행, 숫자 폭 정렬 |
| 49 ArcGIS | 기존 위젯의 카드·경계선 표현 통일 |
| 61쪽 공통 기준 | 한글 sans-serif 글꼴 계열 통일, 2px 키보드 포커스 표시 |

원문 확인: [TomTom](https://www.tomtom.com/newsroom/product-focus/tomtom-traffic-stats-explained/), [Andersen](https://andersenlab.com/project-cases/transport-traffic-light-solution), [ArcGIS](https://www.esri.com/arcgis-blog/products/ops-dashboard/mapping/create-first-arcgis-dashboards/).
HERE 원문은 접근 제한(403)으로 PDF에 수록된 화면만 참고했다. PDF 수록 화면과 사이트의 현재 화면은 다를 수 있다.

## 1차 적용 범위와 제한 — 공통 CSS

- `src/styles/reference-finish.css`를 공통 진입점에서 로드하여 고객 웹·앱, 관리자 웹·앱에 적용한다. 기존 페이지별 토큰과 `!important`로 된 카드 초기화 규칙까지 명시적으로 덮는다.
- 관리자 웹에는 남색 상단바, 카드에는 흰색/짙은 남색 표면과 부드러운 경계, 주요 버튼에는 파란색 채움, 표에는 헤더와 교차 행 구분을 적용했다.
- 라우팅, 데이터, 이벤트 처리, 템플릿과 DOM 구조를 변경하지 않는다.
- 위치, 너비, 높이, 패딩, 마진, 그리드, 정렬 순서, 표시·숨김은 기존 페이지 CSS가 결정한다. 이번 스타일은 해당 속성을 선언하지 않는다.
- 글꼴은 공식 [Pretendard v1.3.9](https://github.com/orioncactus/pretendard/tree/v1.3.9) 가변 폰트를 `public/fonts/`에 포함했다. 설치 여부나 외부 CDN 연결에 의존하지 않는다. OFL 라이선스 원문을 함께 포함했다. 폰트 원본은 약 2MB이고 PWA 빌드에도 포함된다.
- 본문·제목·작은 범례의 기존 글자 크기와 줄 간격은 유지하면서 제목 두께와 색상 위계를 정리했다. 폰트 변경으로 문장 줄바꿈은 일부 달라질 수 있다.
- 위험·통제 색상은 기존 의미를 보존한다. 지도 타일, CCTV 영상, 차트 데이터 표현은 교체하지 않는다.
- 고객 홈의 기존 소개 영역에 직접 만든 도로 선형 SVG 배경을 적용했다. 배경으로만 표시하므로 DOM·버튼·레이아웃에는 영향을 주지 않는다.

## 1차 확인

- 프로덕션 빌드 및 타입 검사 통과.
- 기존 웹 목록 페이징 회귀 검사 통과(OCR, 공지 우선순위 목록, 설비 목록).
- `tests/reference-finish.mjs`: 대표 16개 경로 × 320/390/768/1440px × 라이트/다크 = 128개 화면 조건.
- 신규 스타일을 켜고 끌 때 주요 영역의 레이아웃 CSS가 동일한지, 폰트 실제 로딩, 가로 넘침, 버튼 글자 잘림, 브라우저 오류를 확인한다.
- 카드 배경과 경계, 기본 버튼 채움 및 표 헤더가 기존 강제 스타일을 실제로 덮는지도 검사한다. disabled·readonly 입력창과 비활성 버튼의 회색 표현도 확인한다. 결과와 캡처는 Git에서 제외한 `tests/design-preview/`에 저장한다.
- `tests/design-preview/design-comparison.html`에서 고객 홈·관리자 OCR·관리자 앱 내 정보의 변경 전후를 라이트/다크로 비교할 수 있다.
- API는 테스트 데이터로 대체한다. 실제 CCTV·지도 공급자 서버 연결 상태와 모든 콘텐츠 길이를 검증한 것은 아니다.

## 2차 고객 화면 개선 — 추가 요청 반영

사용자가 고객 지하차도 현황을 제외한 페이지의 어색한 배치·간격·박스 크기 수정과 메인 이미지 추가를 요청했다. 이 추가 요청에 따라 고객 소개·폼 화면은 반응형 배치까지 정리했다. 위의 1차 CSS 한정 조건은 그 이전 작업의 기록이다.

- `customer-premium.css`: 고객 웹 소개·폼·마이페이지의 콘텐츠 폭, 사이드바, 헤더, 폼, 표, 푸터 정렬. 작은 화면에서는 사이드 메뉴를 가로 메뉴로 표시한다. 모바일 고객 앱에서는 지도 외 계정·공지·폼 내부 간격을 정리한다.
- `customer-home-premium.css`, `c-home.vue`: 브랜드 사진이 들어간 메인, 두 개의 안내 카드, 도로 그래픽, 비전 연혁. 기존 이동 경로와 서비스 내용은 유지한다.
- `customer-information.css`: 회사 소개, 비전, 연계 사이트를 동일한 남색·파란색·회청색으로 맞추고 CSS/SVG 그래픽을 추가한다.
- `c-app-guide.css`, `c-app-guide.vue`: 휴대폰 미리보기와 탭 동작은 유지하면서 배경색·카드·버튼·본문 폭을 통일한다.
- 로그인 입력칸과 제출 버튼 너비를 맞추고, 계정 정보 카드와 입력칸의 불필요한 빈 영역을 줄인다.
- 모바일 고객 웹의 표는 제목과 라벨이 있는 목록으로 표시하여 오른쪽 정보를 가로 스크롤 없이 읽을 수 있게 한다. 원래 항목·동작·페이지당 개수는 유지한다.
- 기존 경로·API·계정 처리·알림·검색 기능은 변경하지 않는다.
- `/c-map`, `/c-live-map`, `/customer-app/screen-5`, `/customer-app/screen-6`에는 새 고객 스타일용 클래스를 주지 않는다. 관리자 웹·앱 역시 이번 고객 스타일 적용 대상에서 제외한다.

### 메인 이미지

- 저장 위치: `public/brand/routel-coastal-underpass.png` (1774 × 887, 약 2.8MB).
- 생성 도구: 내장 `image_gen.imagegen` / `imagegen` 스킬. 선택한 결과를 로컬 자산으로 복사하여 사용했다.
- 용도: ROUTEL 도로 안전 서비스의 브랜드 이미지. 실제 특정 지하차도의 사진이나 실시간 CCTV가 아니다. 이미지 대체 텍스트에도 브랜드 이미지라고 표기한다.
- 별도 생성 이미지는 이 한 장이며, 나머지 도식은 코드로 작성한 SVG와 기존 아이콘을 사용한다.
- 적용 프롬프트:

```text
Use case: ads-marketing. Asset type: wide premium website hero image for ROUTEL, a Korean road and underpass safety information service. Create an exceptionally polished photorealistic architectural editorial photograph of a modern coastal Korean city roadway gently descending into a clean short urban underpass. Roads dry after light rain, subtle reflections, early morning soft blue light with warm distant sunlight. A few ordinary cars driving calmly, carefully designed concrete retaining walls, elegant roadside trees, distant city buildings and green hills. The subject is the road and the underpass infrastructure; no people close-up. A natural, reassuring, believable photograph, restrained deep navy, cool blue, warm ivory concrete and soft green palette, high-end corporate transport technology brand feel, no futuristic sci-fi. Wide landscape composition, strong curved leading lines toward the middle-right with some calm architectural space, beautifully balanced exposure. This will fill the right half of a website hero, so put main detail centrally and leave edges uncluttered, all essential elements inside middle 70%. No text, no letters, no logos, no watermarks, no collage, no user interface, no floating pins or charts, no border. Produce a high resolution widescreen landscape image.
```

### 2차 확인

- `tests/customer-premium.mjs`: 고객 21개 경로 × 320/390/768/1440px × 라이트/다크 = 168개 조건에서 가로 넘침, 버튼 글자 잘림, 이미지 로딩, 기존 링크와 브라우저 오류를 검사한다.
- 지하차도 지도·고객 앱 지도·관리자 대시보드 4개 경로 × 같은 화면 조건 = 32개 조건에서 새 고객 스타일 적용 전후의 모든 요소 위치·크기·색상을 비교한다.
- API는 테스트 응답으로 대체한다. 서버에 계정 변경 등 실제 데이터를 쓰지 않는다.
- 화면 캡처: `tests/design-preview/customer-premium/`. 결과와 캡처는 Git에서 제외한다.
- 최종 확인: 프로덕션 빌드·타입 검사, 웹 목록 페이징, 계정 정보 수정·취소·저장 회귀 검사를 통과했다. 앱 소개의 3개 기능 탭·Android/iPhone 안내 탭·설치 안내 앵커·기존 이동 링크도 확인했다.
- 전체 화면 168개·격리 32개 조건 통과 후 모바일 표 보정을 위해 320/390px의 고객 84개·격리 16개 조건을 다시 확인했다. 마지막 공지 목록 압축 표현도 라이트/다크 4개 조건에서 추가 확인했다. 오류·가로 넘침·버튼 잘림은 없었다.

## 3차 관리자 대시보드 — waterAX / water-NET 참고

사용자가 [K-water waterAX의 water-NET 종합상황판](https://waterax.wateround.kr/web/subpage4.do?lang=ko#page1)을 지정해 같은 분위기의 대시보드와 그래프 표현을 요청했다. [종합상황판 소개 이미지](https://waterax.wateround.kr/assets/video/slide/4-1.png)와 [공개 영상](https://waterax.wateround.kr/assets/video/2/2-1.mp4)의 1·5·15초 화면을 확인했다. 파란 헤더, 회청색 배경, 흰 패널, KPI의 색상 구분, 옅은 그래프 격자, 관측점 툴팁을 참고했다. 해당 사이트의 로고·지도·영상은 제품 자산으로 사용하지 않았다.

### 적용

- `water-dashboard.css`: 관리자 웹 종합 현황의 카드·헤더·현황 수치·이벤트·지도 상세 패널을 전용 `.water-dashboard` 범위로 꾸민다. 고객 화면 및 다른 관리자 화면의 테마는 바꾸지 않는다.
- `service-dashboard.vue`: 기존 다섯 KPI에 작은 SVG 아이콘과 의미별 색상을 적용한다. 위험 임박 Top5는 기존 위험 점수를 막대 길이로 함께 보여준다. 데이터가 바뀌면 막대가 650ms 동안 이동하며, 숫자는 실제 값을 그대로 표시한다.
- `DashboardFacilityWidget.vue`, `dashboard-chart.css`: 기존 위험 추이 위젯에 실제 관측 기반 면적·선·시간축·점수축·툴팁을 표시한다. 30분을 넘는 결측 구간은 연결하지 않는다. 단일 관측점과 빈 데이터도 구분한다.
- `ManagerMapPanel.vue`: 대시보드에서만 기존 관측 그래프에 격자·관측점·색상 구분을 더한다. 관측과 예측의 실선·점선 구분 및 기존 설명을 유지한다. `c-live-map.vue`는 이 시각 표현을 활성화하는 선택적 prop만 전달한다.
- 애니메이션은 진입·시설 선택·실제 데이터 변화에 맞춰 한 번 실행하며 임의의 측정값을 만들지 않는다. 운영체제의 동작 줄이기 설정에서는 장식 애니메이션과 전환을 끈다.

### 유지하는 동작과 검증 범위

- 부산 지도, 지역 필터, 지도 마커, 시설 선택, 통제 권한, 알림, API, 이벤트 페이지당 10개는 그대로 유지한다.
- 위젯 추가·이동·크기 조절·저장·복원과 기존 저장 키, 1000분할 배치 계산은 변경하지 않는다. 위험 추이 위젯을 사용자가 추가하지 않았다면 자동으로 추가하지 않는다.
- `tests/water-dashboard.mjs`: 변경 전 기준 파일과 기본 배치·저장 배치 × 390/1440/1920px × 라이트/다크의 12개 조건을 비교한다. 기존 7개 위젯의 위치·크기 차이는 1px 이내여야 한다. 이벤트 페이징, 위험 위젯 추가, 37px 크기 조절, 저장 복원, 동작 줄이기도 검사한다.
- 테스트 응답과 지도 모형을 사용한 캡처는 `tests/design-preview/water-dashboard/`에 저장한다. 외부 실제 지도 캡처를 별도로 만들 때도 API는 검증용 데이터로 대체하므로 운영 현황을 나타내는 자료가 아니다.

### 3차 최종 확인

- 프로덕션 빌드·타입 검사 통과. 기존 HLS 번들의 500kB 초과 경고는 남아 있다.
- 기본·저장 배치 12개 조건에서 기존 7개 위젯의 위치·크기를 유지하고 가로 넘침이 없음을 확인했다.
- 최근 이벤트의 내부 스크롤·바깥 스크롤 전환·10/10/3 페이징과 페이지 변경 시 스크롤 초기화를 확인했다.
- 지도에서 시설을 선택한 뒤 실제 응답값(위험 점수·수위·강수량·관측 12점)이 표시되고, 1440/768/390px의 라이트·다크 6개 조건에서 상세 패널이 지도 영역 안에 유지됨을 확인했다.
- 위험 위젯 추가·37px 폭 조절·저장 후 복원·동작 줄이기를 확인했다. 브라우저 실행 오류는 없었다.
- 위험 차트는 320px 높이의 위젯에서도 시간축이 표시되며, 결측 구간·단일 관측·빈 데이터·키보드 관측점 이동을 별도로 검사했다.
- 실제 카카오 부산 지도에서도 타일 로딩과 위험 그래프 표시를 확인했다. `live-default-preview.png`는 기본 배치, `live-map-preview.png`는 위험 추이를 추가한 예시 배치이며 모두 검증용 API 데이터를 사용했다.

## 4차 관리자 공통 디자인·고객 모션·팝업 여백

사용자가 대시보드의 색상과 표현을 다른 관리자 페이지에도 적용하고, 고객 화면의 애니메이션 및 팝업 여백·다크 모드 가독성을 개선하도록 요청했다. 선택 시설 패널의 상세 접기 버튼은 지하차도 이름 오른쪽으로 이동한다.

- `admin-interface.css`: 관리자 웹·앱·인증 화면에 같은 회청색 배경, 파란 헤더, 흰 패널, 선택 상태, 표 행과 다크 팔레트를 적용한다. 기존 컬럼·페이지 경로·권한·API·페이지당 개수는 유지한다.
- `overlay-polish.css`: 기존 대화상자의 제목·본문·폼·하단 버튼 간격을 구분한다. 일반 입력창, 우측 상세 패널, 앱 창, 알림, 동영상, 주소 검색, 챗봇 등 각 창의 역할에 맞는 폭과 내부 스크롤을 유지한다.
- `ManagerMapPanel.vue`: 선택 시설이 있으면 이름과 접기 버튼을 같은 행에 표시한다. 선택 시설이 없거나 묶음을 선택했을 때의 헤더 토글은 유지한다.
- `interface-motion.css`: 기존 페이지·알림·대화상자·펼친 본문에 180~220ms의 단발 진입 효과를 적용한다. 페이지는 투명도만 바꾸며, 팝업만 짧게 이동한다. 지도 좌표·위젯 크기·시트 드래그·테마 스위치의 원래 이동은 변경하지 않는다.
- 기존 관리자 관측선은 실제 선을 드러내는 효과를 사용하고, 고객 위험 그래프는 다크 모드의 선·점·축 대비를 높인다. 데이터와 예측 점선 표현은 유지한다.
- 동작 줄이기 설정에서는 새 애니메이션과 색상 전환을 끈다. 애니메이션 종료 후 변형이나 추가 쌓임 맥락이 남지 않게 한다.
- `tests/interface-polish.mjs`: 대표 28개 경로의 390/1440px·라이트/다크, 추가 4개 화면의 320/768px로 총 128조건을 확인한다. 팝업 4종의 개폐, 지도 패널 키보드 토글, 필터·페이징도 검사한다. API는 검증용 응답으로 대체한다.

### 4차 최종 확인

- 최종 프로덕션 빌드·타입 검사·PWA 생성과 `git diff --check`를 통과했다. 기존 혼합 정적/동적 import 및 HLS 번들 크기 경고는 남아 있다.
- 대표 화면 128조건과 팝업 4종의 라이트·다크 8조건에서 브라우저 실행 오류, 페이지 외곽 배치 변경, 가로 넘침, 버튼 글자 잘림이 없었다. 팝업 내부 여백과 요청한 지도 제목·접기 버튼 정렬은 의도한 변경이므로 페이지 외곽 비교와 별도로 검사했다.
- 알림 창의 재열기·닫기·Esc 후 초점 복귀, 지도 상세 접기·펼치기의 키보드 동작, 기존 필터·페이지 이동을 확인했다.
- PM 헤더의 숫자 배지는 버튼 밖에 떠 있는 기존 표현이다. 일반 버튼 글자 검사와 분리한 뒤 3개 페이지 × 2개 폭 × 2개 테마에서 조상의 잘림·화면 밖 이탈·사용자명과의 겹침이 없음을 확인했다. 원본 결과를 유지하고 해당 12조건의 재검증 근거를 `reviewed-results.json`에 기록했다.
- 상태 배지의 마지막 색상 보정은 시설 목록·설비 목록의 390/1440px 다크 화면에서 추가 검증했다. 확인한 배지의 글자 대비는 최소 7.51:1이었다.
- 실제 통제 모달도 390/1440px·라이트/다크에서 확인했다. 데스크톱 최대 720px, 모바일 화면 안쪽 여백, 112px 이상 사유 입력 영역을 유지한다.
- 고객·관리자 페이지의 동작 줄이기 설정, 창을 다시 열 때 진입 효과, 기존 시트 드래그·테마 스위치 이동을 확인했다. 데이터나 예측선의 의미를 바꾸는 장식 애니메이션은 넣지 않았다.
- 화면과 결과는 Git에서 제외된 `tests/design-preview/interface-polish/`, 통제 모달은 `tests/design-preview/overlay-polish/`에 저장했다. 검증용 응답을 사용하며 운영 데이터 변경은 없다.

## 5차 헤더·지도·테마와 CCTV·새 알림

- 관리자 공통 헤더에 기존 계정 테마 저장 방식을 사용하는 라이트·다크 전환 버튼을 추가했다. 레거시 관리자 페이지도 같은 해·달 스위치를 사용한다.
- 고객 헤더는 좌우 같은 너비의 칸을 사용하여 로그인 여부와 우측 메뉴 개수에 관계없이 주요 메뉴를 중앙에 맞춘다. 좁은 화면은 메뉴를 다음 행에 중앙 배치하며, 헤더 글자 크기도 높였다.
- 위험 임박 목록은 소수점 점수에 충분한 너비를 주고 시설명은 줄바꿈하도록 하여 가로 넘침을 없앤다. 위젯 크기 조절·세로 스크롤·실제 위험 점수는 유지한다.
- 지하차도 현황의 목록·필터·상세·위험 그래프에 같은 남색·파란색 테마와 다크 대비를 적용했다. 부산 지도, 기존 도구 위치, 검색·선택·시트 드래그는 유지한다. 서랍의 제목·본문·메뉴 여백도 공통 팝업과 맞췄다.
- 홈 사진은 기존 이미지를 사용하면서 밝은/어두운 배경과의 경계를 다듬었다. 연계 사이트는 기관별 공식 투명 로고를 사용하며 원본 출처는 `public/brand/partners/SOURCES.md`에 기록한다.
- 사용자가 확인한 신월여의지하도로 CCTV는 관리자 시설 상세에서 별도 창으로 연다. [서울터널 공식 교통정보](https://seoultunnel.co.kr/usage/traffic.do)의 공개 목록·영상 정보를 기존 `/tunnel-source` 경로로 조회한다. 영상의 실제 시설명과 제공처를 표시하며 선택한 부산 시설의 CCTV 탭은 유지한다.
- 고객 앱의 새 수신 알림은 `ROUTEL` 발신 표시가 있는 앱 내 알림창으로 보여 준다. 최초 조회의 과거 알림은 기준점으로만 사용하고, 새 알림 ID의 중복 표시를 방지한다. 확인은 해당 알림 읽음 처리, 닫기는 읽음 상태 유지, 상세 보기는 기존 알림 내역으로 이동한다. 운영체제의 정부 재난문자 화면·전용 경보음을 제어하는 기능은 아니다.
- 관리자 최근 이벤트는 회색 연결선과 상태 색상의 원형 점, 배지·시설명·내용 카드로 표시한다. 점은 2.8초 주기로 은은하게 빛나며 새 이벤트 카드만 기존 수신 감지에 따라 6초간 강조한다. 최초 기록과 같은 ID의 재조회는 다시 강조하지 않는다. 기존 10개 페이징과 위젯 크기·내부 스크롤을 유지하고 동작 줄이기에서는 점의 애니메이션을 끈다.

### 5차 확인

- 프로덕션 빌드·타입 검사·PWA 생성이 통과했다. 500kB 초과 번들 안내는 남아 있으며 기능 오류는 아니다.
- `tests/interface-refinements.mjs`: 로그인 전후 헤더, 관리자 공통 테마, 고객 웹·앱 지도의 40개 화면 조건을 통과했다. 메뉴의 실제 중앙 정렬, 위험 점수 `40.32` 보존과 가로 넘침, 테마 저장·복원, 시설 선택·상세 접기·목록 복귀를 확인했다.
- 마지막 날씨 카드 색상 보정 후 `--map-only`로 웹·앱 지도 8개 조건을 다시 통과했다. 라이트·다크에서 날씨 카드와 시설 패널의 배경색이 일치하고 브라우저 실행 오류가 없음을 확인했다. `git diff --check`도 통과했다.
- `tests/home-partners-polish.mjs`: 홈과 연계 사이트 3개 페이지의 320/390/768/1440px·라이트/다크 32개 조건을 통과했다. 로고 투명도·원본 비율·로딩, 기존 링크, 가로 넘침·버튼 잘림을 확인했다.
- 고객 앱 알림은 초기 과거 기록 제외, 새 SSE/조회 응답, 중복 방지, 확인 실패 후 재시도, 초점 복귀, 계정 전환·앱 이탈, 동작 줄이기 등 7개 시나리오를 검사했다. 실제 앱의 공통 SSE 경로에서도 표시·확인·중복 처리를 검증했으며 라이트·다크 본문과 확인 버튼의 대비는 4.5:1 이상이었다.
- CCTV는 테스트 응답으로 웹·앱 진입, 카메라 전환 중 이전 응답 무시, 닫기·재시도, 시설별 영상 구분을 확인했다. 실제 서울터널 공개 목록 22개와 640×480 영상 재생도 확인했다. 배포 서버에는 기존 `/tunnel-source/*` 중계 경로가 필요하며 설정은 `docs/API-GUIDE.md`에 기록했다.
- 권한 검사에서는 독립 테스트 브라우저의 계정 상태만 바꿔 `canWrite=false`일 때 CCTV 조회는 유지되고 수정·삭제는 숨겨지는지 확인했다. 현재 제품에는 별도 읽기 전용 관리자 로그인 역할이 없으므로 실제 읽기 전용 계정 로그인 검증은 아니다.
- 화면 검사는 테스트 API·지도 모형을 사용하며 운영 데이터를 변경하지 않는다. 실제 CCTV 재생 캡처는 별도로 `tests/design-preview/tunnel-cctv/`에 보관한다. 고객 알림 캡처는 `tests/design-preview/customer-arrival/`에 있다.
