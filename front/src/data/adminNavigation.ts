export const adminSections = [
  { title: '종합 현황', links: [['대시보드', '/admin-dashboard'], ['통합 로그', '/logs'], ['알림 발송 내역', '/notifications']] },
  { title: '지하차도 관리', links: [['시설 목록', '/fac-list'], ['시설 상세', '/fac-detail'], ['시설 등록', '/fac-new'], ['수동 판별', '/verify']] },
  { title: '예지보전', links: [['설비 목록', '/pm-equipment'], ['설비 상세', '/pm-equipment-detail'], ['점검 대기', '/pm-queue'], ['점검 이력', '/pm-history'], ['기준 설정', '/pm-settings']] },
  { title: '고객 서비스', links: [['고객 관리', '/cs-customers'], ['고객 상세', '/cs-customer-detail'], ['문의 목록', '/cs-inquiries'], ['문의 상세', '/cs-inquiry-detail'], ['공지·FAQ 관리', '/cs-content'], ['공지 편집', '/cs-notice-edit']] },
  { title: '챗봇', links: [['챗봇 통계', '/bot-stats'], ['상담 로그', '/bot-logs']] },
  { title: '교대·인계', links: [['교대 로그인', '/shift-login'], ['교대 리포트', '/shift-report'], ['경찰·소방 전달 문서', '/handover-pdf']] },
  {title:'운영 관리',links:[['관리자 로그인','/admin-login'],['지역·근무조','/admin-data/managers'],['카메라 관리','/admin-data/cameras'],['위험도 임계치','/admin-data/thresholds'],['전광판 문구','/admin-data/display'],['차량 통과 기록','/admin-data/transits'],['경찰·소방 이관','/admin-data/transfers'],['통계·위험 추이','/admin-reports']]},
]
