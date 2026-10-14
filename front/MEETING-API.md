# 추가 기능 연결

- 고객 가입: `/api/customers/check-login-id`, `/check-email`, `/email-code/send`, `/email-code/verify`, `/signup`. 이메일 직접 입력 또는 5개 도메인 선택.
- 관리자 스냅샷: `/api/underpasses/{id}/snapshot` GET/PUT. 업로드 필드 `image`.
- 공지/FAQ 저장: `/api/notices`, `/api/faqs` JSON POST/PUT. 첨부는 각 게시글의 `/attachments` 경로에 별도 POST하고 `notice_attachment` 또는 `faq_attachment`에 기록.
- 위험점수 추이: `/api/underpasses/{id}/risk-scores`. DB의 `risk_score` 기록 사용.
- 개발 DB: `backend/db/schema-reset.sql`과 `backend/db/demo-seed.sql`. 초기화 SQL은 대상 스키마 전체를 삭제.

영상·지도·스냅샷 원본은 전달받은 뒤 실제 자료로 교체합니다.
