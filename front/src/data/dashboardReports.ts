export const dashboardReports: Record<
  string,
  { title: string; path: string; columns: [string, string][] }
> = {
  status: {
    title: '전체 통제 현황',
    path: 'status-summary',
    columns: [
      ['totalCount', '전체 시설'],
      ['normalCount', '정상'],
      ['blockedCount', '통제'],
    ],
  },
  regions: {
    title: '지역별 통제 현황',
    path: 'region-status',
    columns: [
      ['regionName', '지역'],
      ['normalCount', '정상'],
      ['blockedCount', '통제'],
      ['avgRiskScore', '평균 위험도'],
      ['maxRiskScore', '최고 위험도'],
    ],
  },
  kpi: {
    title: '담당 시설 요약',
    path: 'facility-kpi',
    columns: [
      ['facilityCount', '담당 시설'],
      ['blockedCount', '통제'],
      ['pendingReviewCount', '판별 대기'],
      ['remainingCount', '잔류 차량'],
      ['alertsToday', '오늘 알림'],
      ['dangerLevelCount', '위험'],
      ['nearDangerCount', '위험 임박'],
    ],
  },
  scores: {
    title: '최신 위험 점수',
    path: 'risk-scores/latest',
    columns: [
      ['underpassName', '시설'],
      ['riskScore', '위험 점수'],
      ['predictedAt', '관측 시각'],
    ],
  },
  timeline: {
    title: '최근 이벤트',
    path: 'timeline',
    columns: [
      ['underpassName', '시설'],
      ['eventType', '이벤트'],
      ['riskLevel', '단계'],
      ['reason', '사유'],
      ['createdAt', '발생 시각'],
    ],
  },
  thresholds: {
    title: '시설별 임계치',
    path: 'threshold-overview',
    columns: [
      ['underpassName', '시설'],
      ['regionName', '지역'],
      ['level', '단계'],
      ['riskScoreMin', '최소 점수'],
      ['updatedAt', '수정일'],
    ],
  },
  margins: {
    title: '위험 임박 시설',
    path: 'risk-margin',
    columns: [
      ['underpassName', '시설'],
      ['riskScore', '위험 점수'],
      ['dangerThreshold', '위험 임계치'],
      ['margin', '잔여 점수'],
    ],
  },
  trend: {
    title: '위험도 추이',
    path: 'risk-trend',
    columns: [
      ['trendDate', '날짜'],
      ['avgRiskScore', '평균 점수'],
      ['maxRiskScore', '최고 점수'],
    ],
  },
  riskRegions: {
    title: '지역별 위험 단계',
    path: 'region-risk-level',
    columns: [
      ['regionName', '지역'],
      ['safeCount', '안전'],
      ['warningCount', '주의'],
      ['dangerCount', '위험'],
      ['totalCount', '전체'],
    ],
  },
  control: {
    title: '통제 통계',
    path: 'control-stats',
    columns: [
      ['blockCount', '통제 횟수'],
      ['releaseCount', '해제 횟수'],
      ['totalDurationMinutes', '총 통제 시간(분)'],
      ['avgDurationMinutes', '평균 통제 시간(분)'],
    ],
  },
  alerts: {
    title: '알림 통계',
    path: 'alert-stats',
    columns: [
      ['totalCount', '전체 알림'],
      ['predictiveCount', '위험 예측'],
      ['roiFinalCount', '최종 인식'],
    ],
  },
  managers: {
    title: '관리자 활동',
    path: 'manager-activity',
    columns: [
      ['managerName', '관리자'],
      ['blockCount', '통제'],
      ['releaseCount', '해제'],
      ['displayLogCount', '전광판'],
      ['totalCount', '전체'],
    ],
  },
}
