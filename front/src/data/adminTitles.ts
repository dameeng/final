// 사이드바, 업무 화면, 관리자 앱이 공유하는 화면 이름.
export const adminResourceTitles: Record<string, string> = {
  facilities: '지하차도', cameras: '카메라', thresholds: '임계치',
  display: '전광판', transits: '입출구 로그', ocr: 'OCR 인식 기록',
  reviews: '번호판 판별 대기', transfers: '경찰·소방 이관 문서', managers: '관리자·근무조',
  regions: '지역 관리', customers: '고객 조회', inquiries: '문의 처리',
  notices: '공지사항', faqs: 'FAQ', alerts: '알림 발송 기록',
  'manager-notifications': '내 관리자 알림',
  events: '시설 이벤트 로그',
}
const pageTitles: Record<string, string> = {
  '/admin-dashboard': '종합 현황', '/fac-list': adminResourceTitles.facilities!,
  '/fac-detail': '지하차도 상세', '/fac-new': '지하차도 등록',
  '/pm-equipment': '장비 현황', '/pm-equipment-detail': '장비 상세',
  '/pm-queue': '점검 대기', '/pm-history': '점검 이력',
  '/pm-inspection': '점검 확인',
  '/verify': adminResourceTitles.reviews!, '/logs': '시설 이벤트 로그',
  '/notifications': adminResourceTitles.alerts!, '/admin-reports': '통계·위험 추이',
  '/cs-customers': adminResourceTitles.customers!, '/cs-inquiries': adminResourceTitles.inquiries!,
  '/bot-stats': '챗봇', '/bot-logs': '챗봇',
  '/jurisdiction-contacts': '관할 담당자 연락처',
  '/handover-pdf': adminResourceTitles.transfers!,
}
const appAliases: Record<string, string> = {
  'screen-3': '/admin-dashboard', 'screen-4': '/fac-list', 'screen-5': '/fac-detail',
  'screen-9': '/pm-equipment', 'screen-10': '/pm-equipment-detail',
  'screen-11': '/pm-queue', history: '/pm-history', contacts: '/jurisdiction-contacts',
  inspection: '/pm-inspection',
  document: '/handover-pdf', notifications: '/admin-data/manager-notifications',
}
export function adminPageTitle(path: string, fallback = ''): string {
  if (path.startsWith('/admin-app/')) {
    const section = path.split('/').at(-1) || ''
    return appAliases[section] ? adminPageTitle(appAliases[section]!, fallback) : adminResourceTitles[section] || fallback
  }
  return pageTitles[path] || (path.startsWith('/admin-data/') ? adminResourceTitles[path.slice('/admin-data/'.length)] : '') || fallback
}
