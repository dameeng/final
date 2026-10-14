package com.mbc.puf.dashboard.controller;

import java.util.List;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.mbc.puf.common.response.ApiResponse;
import com.mbc.puf.common.security.LoginUser;
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
import com.mbc.puf.dashboard.service.DashboardService;
import com.mbc.puf.underpass.dto.ControlHistoryItem;

/** 통제현황 통계 (MP-06, MP-08) + 관리자 대시보드 전용 확장(KPI/위험점수/타임라인/임계치 현황표/위험임박 TOP
 *  + 위험도 추이/시도별 위험단계 시설수/통제 통계/알림 발송 통계/관리자 활동 건수).
 *  status-summary/region-status는 고객 지도 화면과 관리자 대시보드가 공용으로 쓰는 공개 API로 그대로 둔다.
 *  아래 신규 엔드포인트들은 판별대기·임계치 등 관리자 전용 정보라 인증/인가를 건다.
 *  REGIONAL_ADMIN은 요청 파라미터와 무관하게 본인 담당 지역으로 강제되고, SUPER_ADMIN은 regionId를
 *  자유롭게 넘기거나(특정 지역) 생략(전체)할 수 있다.
 *  facility-kpi/risk-trend/control-stats/alert-stats는 underpassId를 추가로 받아 시설 상세 화면
 *  요약에도 재사용할 수 있고, REGIONAL_ADMIN이 담당 지역 밖 지하차도의 underpassId를 넘기면 403이다 */
@RestController
@RequestMapping("/api/dashboard")
public class DashboardController {

    private static final String REGIONAL_ADMIN = "REGIONAL_ADMIN";
    private static final int DEFAULT_NEAR_MARGIN = 10;
    private static final int DEFAULT_TREND_DAYS = 7;
    private static final int DEFAULT_STATS_DAYS = 30;

    private final DashboardService dashboardService;

    public DashboardController(DashboardService dashboardService) {
        this.dashboardService = dashboardService;
    }

    // 전국 통제현황 그래프 (MP-06): 정상/차단 개수
    @GetMapping("/status-summary")
    public ApiResponse<StatusSummaryResponse> statusSummary() {
        return ApiResponse.ok(dashboardService.getStatusSummary());
    }

    // 도별 통제현황 (MP-08). regionId를 안 주면 전체, 주면 그 지역만(MP-09 관리자 편의 필터로도 재사용)
    @GetMapping("/region-status")
    public ApiResponse<List<RegionStatusItem>> regionStatus(
            @RequestParam(name = "regionId", required = false) Long regionId) {
        return ApiResponse.ok(dashboardService.getRegionStatusList(regionId));
    }

    // KPI 카드: 담당시설수/통제중/판별대기/잔류차량/오늘알림발송/위험단계/위험임박.
    // nearMargin: DANGER 임계치까지 이 점수 이내면 "위험임박"으로 집계(기본 10).
    // underpassId: 주면 그 시설 하나로 좁혀서 시설 상세 화면 요약 카드로도 쓸 수 있다
    @GetMapping("/facility-kpi")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'REGIONAL_ADMIN')")
    public ApiResponse<FacilityKpiSummary> facilityKpi(
            @AuthenticationPrincipal LoginUser loginUser,
            @RequestParam(name = "regionId", required = false) Long regionId,
            @RequestParam(name = "underpassId", required = false) Long underpassId,
            @RequestParam(name = "nearMargin", required = false, defaultValue = "" + DEFAULT_NEAR_MARGIN) int nearMargin) {
        return ApiResponse.ok(dashboardService.getFacilityKpiSummary(scopedRegionId(loginUser, regionId),
                scopedUnderpassId(loginUser, underpassId), nearMargin));
    }

    // 지하차도별 최신 위험점수 1건씩 (목록 화면 스파크라인용)
    @GetMapping("/risk-scores/latest")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'REGIONAL_ADMIN')")
    public ApiResponse<List<RiskScoreOverviewItem>> latestRiskScores(
            @AuthenticationPrincipal LoginUser loginUser,
            @RequestParam(name = "regionId", required = false) Long regionId) {
        return ApiResponse.ok(dashboardService.getLatestRiskScores(scopedRegionId(loginUser, regionId)));
    }

    // 통합 타임라인 (이벤트+전광판+알림 발송, 최신순)
    @GetMapping("/timeline")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'REGIONAL_ADMIN')")
    public ApiResponse<List<ControlHistoryItem>> timeline(
            @AuthenticationPrincipal LoginUser loginUser,
            @RequestParam(name = "regionId", required = false) Long regionId,
            @RequestParam(name = "limit", required = false, defaultValue = "30") int limit) {
        return ApiResponse.ok(dashboardService.getTimeline(scopedRegionId(loginUser, regionId), limit));
    }

    // 최고관리자 "전체 임계치 현황표"
    @GetMapping("/threshold-overview")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'REGIONAL_ADMIN')")
    public ApiResponse<List<ThresholdOverviewItem>> thresholdOverview(
            @AuthenticationPrincipal LoginUser loginUser,
            @RequestParam(name = "regionId", required = false) Long regionId) {
        return ApiResponse.ok(dashboardService.getThresholdOverview(scopedRegionId(loginUser, regionId)));
    }

    // "위험 임박 TOP": DANGER 임계치까지 남은 점수(margin) 오름차순으로 DB가 정렬해서 반환 (기본 8건)
    @GetMapping("/risk-margin")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'REGIONAL_ADMIN')")
    public ApiResponse<List<RiskMarginItem>> riskMargin(
            @AuthenticationPrincipal LoginUser loginUser,
            @RequestParam(name = "regionId", required = false) Long regionId,
            @RequestParam(name = "limit", required = false, defaultValue = "8") int limit) {
        return ApiResponse.ok(dashboardService.getRiskMarginList(scopedRegionId(loginUser, regionId), limit));
    }

    // 지역별(또는 전국, 또는 시설 하나) 위험도 추이(기간별). days 안 주면 최근 7일, 일자별 평균/최대 위험점수.
    // underpassId: 주면 그 시설 하나로 좁혀서 시설 상세 화면에서도 쓸 수 있다
    @GetMapping("/risk-trend")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'REGIONAL_ADMIN')")
    public ApiResponse<List<RiskTrendPoint>> riskTrend(
            @AuthenticationPrincipal LoginUser loginUser,
            @RequestParam(name = "regionId", required = false) Long regionId,
            @RequestParam(name = "underpassId", required = false) Long underpassId,
            @RequestParam(name = "days", required = false, defaultValue = "" + DEFAULT_TREND_DAYS) int days) {
        return ApiResponse.ok(dashboardService.getRiskTrend(scopedRegionId(loginUser, regionId),
                scopedUnderpassId(loginUser, underpassId), days));
    }

    // 시·도별 안전/경고/위험 시설 수 (현재 위험단계 기준 스냅샷)
    @GetMapping("/region-risk-level")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'REGIONAL_ADMIN')")
    public ApiResponse<List<RegionRiskLevelItem>> regionRiskLevel(
            @AuthenticationPrincipal LoginUser loginUser,
            @RequestParam(name = "regionId", required = false) Long regionId) {
        return ApiResponse.ok(dashboardService.getRegionRiskLevel(scopedRegionId(loginUser, regionId)));
    }

    // 통제 통계(차단·해제 건수 + 지속시간). days 안 주면 최근 30일.
    // underpassId: 주면 그 시설 하나로 좁혀서 시설 상세 화면에서도 쓸 수 있다
    @GetMapping("/control-stats")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'REGIONAL_ADMIN')")
    public ApiResponse<ControlStatsSummary> controlStats(
            @AuthenticationPrincipal LoginUser loginUser,
            @RequestParam(name = "regionId", required = false) Long regionId,
            @RequestParam(name = "underpassId", required = false) Long underpassId,
            @RequestParam(name = "days", required = false, defaultValue = "" + DEFAULT_STATS_DAYS) int days) {
        return ApiResponse.ok(dashboardService.getControlStats(scopedRegionId(loginUser, regionId),
                scopedUnderpassId(loginUser, underpassId), days));
    }

    // 알림 발송 통계(유형별 건수). days 안 주면 최근 30일.
    // underpassId: 주면 그 시설 하나로 좁혀서 시설 상세 화면에서도 쓸 수 있다
    @GetMapping("/alert-stats")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'REGIONAL_ADMIN')")
    public ApiResponse<AlertStatsSummary> alertStats(
            @AuthenticationPrincipal LoginUser loginUser,
            @RequestParam(name = "regionId", required = false) Long regionId,
            @RequestParam(name = "underpassId", required = false) Long underpassId,
            @RequestParam(name = "days", required = false, defaultValue = "" + DEFAULT_STATS_DAYS) int days) {
        return ApiResponse.ok(dashboardService.getAlertStats(scopedRegionId(loginUser, regionId),
                scopedUnderpassId(loginUser, underpassId), days));
    }

    // 관리자별 활동 건수(차단·해제·전광판 조작 합계). days 안 주면 최근 30일, 활동 없는 관리자는 제외
    @GetMapping("/manager-activity")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'REGIONAL_ADMIN')")
    public ApiResponse<List<ManagerActivityItem>> managerActivity(
            @AuthenticationPrincipal LoginUser loginUser,
            @RequestParam(name = "regionId", required = false) Long regionId,
            @RequestParam(name = "days", required = false, defaultValue = "" + DEFAULT_STATS_DAYS) int days) {
        return ApiResponse.ok(dashboardService.getManagerActivity(scopedRegionId(loginUser, regionId), days));
    }

    // REGIONAL_ADMIN은 요청 파라미터를 무시하고 본인 지역으로 고정, SUPER_ADMIN은 요청값 그대로(전체=null 포함)
    private Long scopedRegionId(LoginUser loginUser, Long requestedRegionId) {
        return REGIONAL_ADMIN.equals(loginUser.role()) ? loginUser.regionId() : requestedRegionId;
    }

    // REGIONAL_ADMIN이 담당 지역 밖 지하차도의 underpassId를 넘기면 403(서비스에서 검증), SUPER_ADMIN은 제한 없음.
    // underpassId가 null이면 그대로 null 반환(시설 단위로 안 좁히는 조회)
    private Long scopedUnderpassId(LoginUser loginUser, Long underpassId) {
        if (underpassId != null && REGIONAL_ADMIN.equals(loginUser.role())) {
            dashboardService.requireUnderpassInRegion(underpassId, loginUser.regionId());
        }
        return underpassId;
    }
}