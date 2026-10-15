# 현황 갱신

| 화면 | 백엔드 경로 | 간격 |
| --- | --- | --- |
| 관리자 시설 목록 | `GET /api/underpasses?page=1&size=100` | 30초 |
| 고객 지도 | `GET /api/underpasses?page=1&size=100` | 30초 |
| 고객 앱 시설 | `GET /api/underpasses?page=1&size=1000` | 30초 |
| 위험점수 추이 | `GET /api/underpasses/{id}/risk-scores?limit=24` | 30초 |
| 공지 목록 | `GET /api/notices?page=1&size=100` | 30초 |

통제는 `POST /api/underpasses/{id}/block`, 해제는 `POST /api/underpasses/{id}/release`입니다. 관리자 세션 쿠키가 필요합니다.
