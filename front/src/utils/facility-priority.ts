type Facility = Record<string, any>
const priority: Record<string, number> = {
  SEVERE: 6, 심각: 6, DANGER: 5, 위험: 5, ALERT: 4, 경계: 4,
  WARNING: 3, CAUTION: 3, 경고: 3, 주의: 3, WATCH: 2, 관심: 2,
  SAFE: 1, NORMAL: 1, 안전: 1, 정상: 1,
}
const score = (row: Facility) => {
  const value = Number(row.riskScore ?? row.currentRiskScore)
  return Number.isFinite(value) ? value : -1
}
export function compareFacilityPriority(a: Facility, b: Facility) {
  return Number(b.currentStatus === 'BLOCKED') - Number(a.currentStatus === 'BLOCKED') ||
    (priority[String(b.currentRiskLevel).toUpperCase()] || 0) - (priority[String(a.currentRiskLevel).toUpperCase()] || 0) ||
    score(b) - score(a) || String(a.name || '').localeCompare(String(b.name || ''), 'ko') || Number(a.id) - Number(b.id)
}
