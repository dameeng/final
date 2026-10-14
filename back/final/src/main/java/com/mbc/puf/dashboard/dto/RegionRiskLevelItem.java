package com.mbc.puf.dashboard.dto;

/** 시·도별 안전/경고/위험 시설 수(현재 current_risk_level 기준 스냅샷).
 *  지하차도가 하나도 없는 지역도 0건으로 포함된다 */
public class RegionRiskLevelItem {

    private Long regionId;
    private String regionName;
    private long safeCount;
    private long warningCount;
    private long dangerCount;
    private long totalCount;

    public RegionRiskLevelItem() {
    }

    public Long getRegionId() { return regionId; }
    public void setRegionId(Long regionId) { this.regionId = regionId; }

    public String getRegionName() { return regionName; }
    public void setRegionName(String regionName) { this.regionName = regionName; }

    public long getSafeCount() { return safeCount; }
    public void setSafeCount(long safeCount) { this.safeCount = safeCount; }

    public long getWarningCount() { return warningCount; }
    public void setWarningCount(long warningCount) { this.warningCount = warningCount; }

    public long getDangerCount() { return dangerCount; }
    public void setDangerCount(long dangerCount) { this.dangerCount = dangerCount; }

    public long getTotalCount() { return totalCount; }
    public void setTotalCount(long totalCount) { this.totalCount = totalCount; }
}
