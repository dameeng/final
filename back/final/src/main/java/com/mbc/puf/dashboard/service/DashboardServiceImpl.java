package com.mbc.puf.dashboard.service;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mbc.puf.common.exception.BusinessException;
import com.mbc.puf.dashboard.dao.DashboardDao;
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
import com.mbc.puf.underpass.dao.UnderpassDao;
import com.mbc.puf.underpass.dto.ControlHistoryItem;
import com.mbc.puf.underpass.dto.UnderpassDetailResponse;

@Service
public class DashboardServiceImpl implements DashboardService {

    private final DashboardDao dashboardDao;
    private final UnderpassDao underpassDao;

    public DashboardServiceImpl(DashboardDao dashboardDao, UnderpassDao underpassDao) {
        this.dashboardDao = dashboardDao;
        this.underpassDao = underpassDao;
    }

    @Override
    @Transactional(readOnly = true)
    public StatusSummaryResponse getStatusSummary() {
        return dashboardDao.selectStatusSummary();
    }

    @Override
    @Transactional(readOnly = true)
    public List<RegionStatusItem> getRegionStatusList(Long regionId) {
        return dashboardDao.selectRegionStatusList(regionId);
    }

    @Override
    @Transactional(readOnly = true)
    public FacilityKpiSummary getFacilityKpiSummary(Long regionId, Long underpassId, int nearMargin) {
        return dashboardDao.selectFacilityKpiSummary(regionId, underpassId, nearMargin);
    }

    @Override
    @Transactional(readOnly = true)
    public List<RiskScoreOverviewItem> getLatestRiskScores(Long regionId) {
        return dashboardDao.selectLatestRiskScores(regionId);
    }

    @Override
    @Transactional(readOnly = true)
    public List<ControlHistoryItem> getTimeline(Long regionId, int limit) {
        return dashboardDao.selectTimeline(regionId, limit);
    }

    @Override
    @Transactional(readOnly = true)
    public List<ThresholdOverviewItem> getThresholdOverview(Long regionId) {
        return dashboardDao.selectThresholdOverview(regionId);
    }

    @Override
    @Transactional(readOnly = true)
    public List<RiskMarginItem> getRiskMarginList(Long regionId, int limit) {
        return dashboardDao.selectRiskMarginList(regionId, limit);
    }

    @Override
    @Transactional(readOnly = true)
    public List<RiskTrendPoint> getRiskTrend(Long regionId, Long underpassId, int days) {
        return dashboardDao.selectRiskTrend(regionId, underpassId, days);
    }

    @Override
    @Transactional(readOnly = true)
    public List<RegionRiskLevelItem> getRegionRiskLevel(Long regionId) {
        return dashboardDao.selectRegionRiskLevelCounts(regionId);
    }

    @Override
    @Transactional(readOnly = true)
    public ControlStatsSummary getControlStats(Long regionId, Long underpassId, int days) {
        return dashboardDao.selectControlStats(regionId, underpassId, days);
    }

    @Override
    @Transactional(readOnly = true)
    public AlertStatsSummary getAlertStats(Long regionId, Long underpassId, int days) {
        return dashboardDao.selectAlertStats(regionId, underpassId, days);
    }

    @Override
    @Transactional(readOnly = true)
    public List<ManagerActivityItem> getManagerActivity(Long regionId, int days) {
        return dashboardDao.selectManagerActivity(regionId, days);
    }

    // REGIONAL_ADMIN이 다른 지역 소속 지하차도의 underpassId로 시설별 통계를 요청하면 403.
    // (컨트롤러의 scopedRegionId가 이미 regionId를 본인 지역으로 강제하긴 하지만, SQL이 두 필터를
    //  AND로 묶어 "조용히 빈 배열"을 주는 것보다 여기서 바로 막아서 분명한 에러로 알려주는 쪽을 택함)
    @Override
    @Transactional(readOnly = true)
    public void requireUnderpassInRegion(Long underpassId, Long regionId) {
        UnderpassDetailResponse underpass = underpassDao.selectUnderpassById(underpassId);
        if (underpass == null) {
            throw new BusinessException(HttpStatus.NOT_FOUND, "존재하지 않는 지하차도입니다. id=" + underpassId);
        }
        if (!regionId.equals(underpass.getRegionId())) {
            throw new BusinessException(HttpStatus.FORBIDDEN, "담당 지역 외 지하차도의 통계는 조회할 수 없습니다.");
        }
    }
}