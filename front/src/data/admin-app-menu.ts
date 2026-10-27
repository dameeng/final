import { adminPageTitle } from './adminTitles'
export const adminAppMenuGroups = [
  {
    title: '현황·시설',
    links: [
      ['종합 현황', '/admin-app/screen-3'],
      ['지하차도·통제', '/admin-app/screen-4'],
      ['관할 담당자 연락처', '/admin-app/contacts'],
    ],
  },
  {
    title: '차량 기록',
    links: [
      ['OCR 인식 기록', '/admin-app/ocr'],
      ['번호판 판별 대기', '/admin-app/reviews'],
      ['입출구 로그', '/admin-app/transits'],
    ],
  },
  {
    title: '예지보전',
    links: [
      ['설비 목록', '/admin-app/screen-9'],
      ['점검 대상·알림', '/admin-app/screen-11'],
      ['점검 이력', '/admin-app/history'],
    ],
  },
  {
    title: '알림·운영',
    links: [
      ['내 관리자 알림', '/admin-app/notifications'],
      ['더보기·내 정보', '/admin-app/screen-14'],
    ],
  },
].map(group => ({ ...group, links: group.links.map(([label, ...paths]) => [adminPageTitle(paths.find(Boolean) || '', label), ...paths]) }))
