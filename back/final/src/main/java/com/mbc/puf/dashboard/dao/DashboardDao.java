package com.mbc.puf.dashboard.dao;

import java.util.List;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

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

@Mapper
public interface DashboardDao {

    // 전체 지하차도의 정상/차단 개수 (MP-06)
    StatusSummaryResponse selectStatusSummary();

    // 지역별 정상/차단 개수 + 평균/최대 위험점수 (MP-08). regionId가 null이면 전체 지역, 아니면 그 지역만.
    // 지하차도가 없는 지역도 0건으로 포함된다
    List<RegionStatusItem> selectRegionStatusList(@Param("regionId") Long regionId);

    // KPI 카드: 담당시설수/통제중/판별대기/잔류차량/오늘알림발송 + 위험단계/위험임박 시설 수(DANGER 임계치 비교,
    // DB에서 직접 계산). nearMargin은 "위험임박"으로 칠 DANGER 임계치까지의 여유 점수(예: 10).
    // underpassId를 주면 그 시설 하나로 좁혀서 시설 상세 화면 요약 카드로도 쓸 수 있다
    FacilityKpiSummary selectFacilityKpiSummary(@Param("regionId") Long regionId, @Param("underpassId") Long underpassId,
                                                 @Param("nearMargin") int nearMargin);

    // 지하차도별 최신 위험점수 1건씩 (목록 화면 스파크라인용, N+1 방지). regionId가 null이면 전체
    List<RiskScoreOverviewItem> selectLatestRiskScores(@Param("regionId") Long regionId);

    // region 전체(또는 전국) 스코프의 event+display_log+alert_log 통합 타임라인, 최신순 limit개
    List<ControlHistoryItem> selectTimeline(@Param("regionId") Long regionId, @Param("limit") int limit);

    // 여러 지하차도의 임계치를 한 번에 (최고관리자 "전체 임계치 현황표"). regionId가 null이면 전체
    List<ThresholdOverviewItem> selectThresholdOverview(@Param("regionId") Long regionId);

    // "위험 임박 TOP": 최신 위험점수가 있는 시설만, DANGER 임계치까지 남은 점수(margin) 오름차순(가장 급한 것부터).
    // 위험점수가 아직 없는 시설은 비교 불가라 제외된다
    List<RiskMarginItem> selectRiskMarginList(@Param("regionId") Long regionId, @Param("limit") int limit);

    // 지역별(또는 전국, 또는 시설 하나) 위험도 추이: 최근 days일, 일자별 평균/최대 위험점수.
    // underpassId를 주면 그 시설 하나로 좁혀서 시설 상세 화면에서도 쓸 수 있다
    List<RiskTrendPoint> selectRiskTrend(@Param("regionId") Long regionId, @Param("underpassId") Long underpassId,
                                          @Param("days") int days);

    // 시·도별 안전/경고/위험 시설 수 (current_risk_level 기준 스냅샷). regionId가 null이면 전체
    List<RegionRiskLevelItem> selectRegionRiskLevelCounts(@Param("regionId") Long regionId);

    // 통제 통계(기간 내 차단·해제 건수 + BLOCK→RELEASE 쌍의 지속시간). underpassId를 주면 그 시설 하나로 좁힌다
    ControlStatsSummary selectControlStats(@Param("regionId") Long regionId, @Param("underpassId") Long underpassId,
                                            @Param("days") int days);

    // 알림 발송 통계(기간 내 유형별 건수). underpassId를 주면 그 시설 하나로 좁힌다
    AlertStatsSummary selectAlertStats(@Param("regionId") Long regionId, @Param("underpassId") Long underpassId,
                                        @Param("days") int days);

    // 관리자별 활동 건수(기간 내 차단·해제·전광판 조작 합계). 활동이 없는 관리자는 결과에서 빠진다
    List<ManagerActivityItem> selectManagerActivity(@Param("regionId") Long regionId, @Param("days") int days);
}