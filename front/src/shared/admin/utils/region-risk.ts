import type { Underpass } from '../services/underpasses'

export const regionNames = ['서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종', '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'] as const
const aliases: Record<string, string> = {
  서울특별시: '서울', 부산광역시: '부산', 대구광역시: '대구', 인천광역시: '인천', 광주광역시: '광주', 대전광역시: '대전', 울산광역시: '울산',
  세종특별자치시: '세종', 경기도: '경기', 강원특별자치도: '강원', 강원도: '강원', 충청북도: '충북', 충청남도: '충남',
  전북특별자치도: '전북', 전라북도: '전북', 전라남도: '전남', 경상북도: '경북', 경상남도: '경남', 제주특별자치도: '제주', 제주도: '제주',
}
export function normalizeRegion(value: string): string {
  const name = value.trim() || '미배정'
  const first = name.split(/\s+/)[0] || name
  return aliases[first] ?? (regionNames.find(region => region === first)) ?? name
}
export type RiskGroup = 'safe' | 'warning' | 'danger' | 'unknown'
export type RegionRisk = { name: string; total: number; safe: number; warning: number; danger: number; unknown: number; ratio: number }
export function riskGroup(item: Underpass): RiskGroup {
  // Control overrides a stale safe prediction; unreceived predictions stay unknown.
  if (item.status === '통제' || item.riskLevel === 'DANGER') return 'danger'
  if (item.riskLevel === 'WARNING' || item.status === '주의') return 'warning'
  if (item.riskLevel === 'SAFE') return 'safe'
  if (!item.riskLevel && item.status === '정상') return 'safe'
  return 'unknown'
}
export function aggregateRegions(items: Underpass[]): RegionRisk[] {
  const result = new Map<string, RegionRisk>()
  for (const item of items) {
    const name = normalizeRegion(item.region)
    const row = result.get(name) ?? { name, total: 0, safe: 0, warning: 0, danger: 0, unknown: 0, ratio: 0 }
    row.total += 1
    row[riskGroup(item)] += 1
    result.set(name, row)
  }
  return [...result.values()].map(row => ({ ...row, ratio: row.danger / row.total * 100 }))
    .sort((a, b) => b.ratio - a.ratio || b.danger - a.danger || a.name.localeCompare(b.name, 'ko'))
}
