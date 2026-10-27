import { adminPageTitle } from './adminTitles'
export const adminSidebarGroups = [
  {
    title: '지하차도 관리',
    links: [
      ['지하차도', '/fac-list', '/admin-data/facilities'],
      ['카메라', '', '/admin-data/cameras'],
      ['임계치', '', '/admin-data/thresholds'],
      ['전광판', '', '/admin-data/display'],
    ],
  },
  {
    title: '예지보전',
    links: [
      ['장비 현황', '/pm-equipment', '/pm-equipment'],
      ['점검 대기', '/pm-queue', '/pm-queue'],
      ['정비 이력', '/pm-history', '/pm-history'],
    ],
  },
  {
    title: '차량 기록',
    links: [
      ['OCR 인식 기록', '', '/admin-data/ocr'],
      ['번호판 판별 대기', '/verify', '/admin-data/reviews'],
      ['입출구 로그', '', '/admin-data/transits'],
    ],
  },
  {
    title: '안전 대응',
    links: [
      ['경찰·소방 이관', '', '/admin-data/transfers'],
      ['관할 담당자 연락처', '/jurisdiction-contacts', '/jurisdiction-contacts'],
      ['통계·위험 추이', '', '/admin-reports'],
      ['시설 이벤트 로그', '/logs', '/logs'],
    ],
  },
  {
    title: '고객·지원',
    links: [
      ['고객 조회', '/cs-customers', '/admin-data/customers'],
      ['문의 처리', '', '/admin-data/inquiries'],
      ['공지사항', '', '/admin-data/notices'],
      ['FAQ', '', '/admin-data/faqs'],
      ['챗봇', '/bot-stats', '/bot-stats'],
      ['알림 발송 기록', '', '/admin-data/alerts'],
    ],
  },
  {
    title: '운영·설정',
    links: [
      ['관리자·근무조', '', '/admin-data/managers'],
      ['지역 관리', '', '/admin-data/regions'],
    ],
  },
].map(group => ({ ...group, links: group.links.map(([label, ...paths]) => [adminPageTitle(paths.find(Boolean) || '', label), ...paths]) }))

export function sidebarLinkActive(link: string[], path: string) {
  return (
    link.slice(1).includes(path) ||
    (link[1] === '/fac-list' && path === '/fac-detail') ||
    (link[1] === '/pm-equipment' && path === '/pm-equipment-detail') ||
    (link[1] === '/bot-stats' && path.startsWith('/bot-'))
  )
}
