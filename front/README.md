# routel-admin 통합 프로젝트

Node.js 22.18+, Java 17+, PostgreSQL이 필요합니다.

## 프런트엔드 (8282)

```bash
npm install
npm run dev
```

- 고객 웹: http://localhost:8282/
- 고객 앱: http://localhost:8282/app/
- 관리자: http://localhost:8282/manager/

`npm run build`로 세 화면을 빌드합니다. Vite는 `/api`를 백엔드 `http://localhost:5555`로 전달합니다.

## 백엔드와 DB (5555)

`backend/db/schema-reset.sql`은 개발 DB의 public 스키마를 **통째로 삭제**합니다. 비어 있는 별도 개발 DB에만 적용하세요. 이어서 `backend/db/demo-seed.sql`을 실행합니다.

```bash
psql -d routel_dev -f backend/db/schema-reset.sql
psql -d routel_dev -f backend/db/demo-seed.sql
cd backend
DB_PASSWORD='개발 DB 비밀번호' PUF_INTERNAL_API_KEY='내부 API 키' bash mvnw spring-boot:run
```

DB 연결 주소·계정 및 메일 발송 설정은 `backend/src/main/resources/application.properties`와 환경 변수로 지정합니다. 비밀번호를 Git에 올리지 마세요.

`model/`에는 제공된 침수 예측·차량 인식 모델이 있습니다. 모델 실행 서비스는 별도로 필요합니다. 위험점수 0~100은 확률이 아닙니다.

`team-frontend/`에는 팀 프런트 원본을 보존했습니다. 실행 진입점은 루트 `src/`입니다. 스냅샷은 파일로 저장하고, 게시판 첨부 메타데이터는 `notice_attachment`와 `faq_attachment`에 저장합니다. 시드에 기재된 데모 첨부 파일의 실물은 제공되지 않았습니다.

CCTV 영상과 스냅샷 사진 원본은 제공된 ZIP에 없어 해당 파일을 받은 뒤 교체할 수 있습니다.

고객 지하차도 지도에는 조원 제공 지도 구성과 상태별 마커를 적용했습니다. 공개 `/api/underpasses` 목록은 로그인 없이 조회합니다. 기상청에서 전달한 HTML은 화면 구성 참고 자료입니다.
