package com.mbc.puf.threshold.dto;

import java.math.BigDecimal;

/** threshold_history 테이블 INSERT용 (내부용). changed_at은 DB 기본값(NOW())을 그대로 쓴다 */
public class ThresholdHistory {

    private Long thresholdId;
    private BigDecimal oldRiskScoreMin;   // 최초 생성이면 null
    private BigDecimal newRiskScoreMin;
    private Long changedBy;

    public ThresholdHistory() {
    }

    public Long getThresholdId() { return thresholdId; }
    public void setThresholdId(Long thresholdId) { this.thresholdId = thresholdId; }

    public BigDecimal getOldRiskScoreMin() { return oldRiskScoreMin; }
    public void setOldRiskScoreMin(BigDecimal oldRiskScoreMin) { this.oldRiskScoreMin = oldRiskScoreMin; }

    public BigDecimal getNewRiskScoreMin() { return newRiskScoreMin; }
    public void setNewRiskScoreMin(BigDecimal newRiskScoreMin) { this.newRiskScoreMin = newRiskScoreMin; }

    public Long getChangedBy() { return changedBy; }
    public void setChangedBy(Long changedBy) { this.changedBy = changedBy; }
}
