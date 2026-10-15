package com.mbc.puf.dashboard.service;

import java.util.List;

import com.mbc.puf.dashboard.dto.AlertStatsSummary;
import com.mbc.puf.dashboard.dto.ControlStatsSummary;
import com.mbc.puf.dashboard.dto.FacilityKpiSummary;
import com.mbc.puf.dashboard.dto.ManagerActivityItem;
import com.mbc.puf.dashboard.dto.RegionRiskLevelItem;
import com.mbc.puf.dashboard.dto.RegionStatusItem;
import com.mbc.puf.dashboard.dto.RiskMarginItem;
import com.mbc.puf.dashboard.dto.RiskScoreOverviewItem;
import com.mbc.puf.dashboard.dto.RiskTrendPoint;
import com.mbc.puf.dashboard.dto.StatusSummaryResponse;
import com.mbc.puf.dashboard.dto.ThresholdOverviewItem;
import com.mbc.puf.underpass.dto.ControlHistoryItem;

public interface DashboardService {

    // 전국 통제현황 그래프 (MP-06)
    StatusSummaryResponse getStatusSummary();

    // 도별 통제현황 (MP-08). regionId가 null이면 전체, 아니면 그 지역만(1건 또는 0건)
    List<RegionStatusItem> getRegionStatusList(Long regionId);

    // KPI 카드. regionId가 null이면 전체, underpassId가 null이면 전체 시설(시설 하나로 좁히려면 underpassId 지정).
    // nearMargin은 "위험임박" 판정 기준(DANGER 임계치까지 남은 점수)
    FacilityKpiSummary getFacilityKpiSummary(Long regionId, Long underpassId, int nearMargin);

    // 지하차도별 최신 위험점수 1건씩. regionId가 null이면 전체
    List<RiskScoreOverviewItem> getLatestRiskScores(Long regionId);

    // 통합 타임라인 최신순 limit개. regionId가 null이면 전체
    List<ControlHistoryItem> getTimeline(Long regionId, int limit);

    // 전체 임계치 현황표. regionId가 null이면 전체
    List<ThresholdOverviewItem> getThresholdOverview(Long regionId);

    // 위험 임박 TOP. regionId가 null이면 전체
    List<RiskMarginItem> getRiskMarginList(Long regionId, int limit);

    // 지역별(또는 전국, 또는 시설 하나) 위험도 추이(기간별, 일자별 평균/최대)
    List<RiskTrendPoint> getRiskTrend(Long regionId, Long underpassId, int days);

    // 시·도별 안전/경고/위험 시설 수
    List<RegionRiskLevelItem> getRegionRiskLevel(Long regionId);

    // 통제 통계(기간 내 차단·해제 건수 및 지속시간). underpassId가 null이면 전체 시설
    ControlStatsSummary getControlStats(Long regionId, Long underpassId, int days);

    // 알림 발송 통계(기간 내 유형별 건수). underpassId가 null이면 전체 시설
    AlertStatsSummary getAlertStats(Long regionId, Long underpassId, int days);

    // 관리자별 활동 건수(기간 내)
    List<ManagerActivityItem> getManagerActivity(Long regionId, int days);

    // REGIONAL_ADMIN이 본인 담당 지역이 아닌 지하차도의 underpassId로 시설별 통계를 보려 하면 차단(403).
    // 지하차도 자체가 없으면 404. regionId는 호출하는 관리자의 담당 지역(REGIONAL_ADMIN일 때만 호출됨)
    void requireUnderpassInRegion(Long underpassId, Long regionId);
}