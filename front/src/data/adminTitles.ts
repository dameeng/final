// 사이드바, 업무 화면, 관리자 앱이 공유하는 화면 이름.
export const adminResourceTitles: Record<string, string> = {
  facilities: '지하차도 현황', cameras: '카메라 관리', thresholds: '위험단계 기준',
  display: '전광판 관리', transits: '차량 입출차 기록', ocr: '번호판 인식 기록',
  reviews: '번호판 확인 대기', transfers: '상황보고·기관 전달', managers: '관리자·근무조',
  regions: '지역 관리', customers: '고객 조회', inquiries: '문의 관리',
  notices: '공지사항', faqs: '자주 묻는 질문', alerts: '알림 전송 내역',
  'manager-notifications': '내 관리자 알림',
  events: '위험·통제 이력',
}
const pageTitles: Record<string, string> = {
  '/admin-dashboard': '종합 현황', '/fac-list': adminResourceTitles.facilities!,
  '/fac-detail': '지하차도 상세', '/fac-new': '지하차도 등록',
  '/pm-equipment': '설비 현황', '/pm-equipment-detail': '설비 상세',
  '/pm-queue': '점검 대기', '/pm-history': '점검·정비 이력',
  '/pm-inspection': '점검 확인',
  '/pm-settings': '설비·점검 기준', '/pm-daily': '일일 점검 보고서',
  '/verify': adminResourceTitles.reviews!, '/logs': adminResourceTitles.events!,
  '/notifications': adminResourceTitles.alerts!, '/admin-reports': '위험도 통계',
  '/cs-customers': adminResourceTitles.customers!, '/cs-inquiries': adminResourceTitles.inquiries!,
  '/bot-stats': '챗봇', '/bot-logs': '챗봇',
  '/jurisdiction-contacts': '비상 연락망',
  '/handover-pdf': adminResourceTitles.transfers!,
}
const appAliases: Record<string, string> = {
  'screen-3': '/admin-dashboard', 'screen-4': '/fac-list', 'screen-5': '/fac-detail',
  'screen-9': '/pm-equipment', 'screen-10': '/pm-equipment-detail',
  'screen-11': '/pm-queue', history: '/pm-history', contacts: '/jurisdiction-contacts',
  inspection: '/pm-inspection',
  'pm-settings': '/pm-settings', 'pm-daily': '/pm-daily',
  document: '/handover-pdf', notifications: '/admin-data/manager-notifications',
}
export function adminPageTitle(path: string, fallback = ''): string {
  if (path.startsWith('/admin-app/')) {
    const section = path.split('/').at(-1) || ''
    return appAliases[section] ? adminPageTitle(appAliases[section]!, fallback) : adminResourceTitles[section] || fallback
  }
  return pageTitles[path] || (path.startsWith('/admin-data/') ? adminResourceTitles[path.slice('/admin-data/'.length)] : '') || fallback
}
