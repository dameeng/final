package com.mbc.puf.threshold.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import com.mbc.puf.common.enums.RiskLevel;

/** threshold 테이블 INSERT/UPDATE/SELECT용 (내부용) */
public class Threshold {

    private Long id;
    private Long underpassId;
    private RiskLevel level;
    private BigDecimal riskScoreMin;
    private Long updatedBy;
    private LocalDateTime updatedAt;

    public Threshold() {
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getUnderpassId() { return underpassId; }
    public void setUnderpassId(Long underpassId) { this.underpassId = underpassId; }

    public RiskLevel getLevel() { return level; }
    public void setLevel(RiskLevel level) { this.level = level; }

    public BigDecimal getRiskScoreMin() { return riskScoreMin; }
    public void setRiskScoreMin(BigDecimal riskScoreMin) { this.riskScoreMin = riskScoreMin; }

    public Long getUpdatedBy() { return updatedBy; }
    public void setUpdatedBy(Long updatedBy) { this.updatedBy = updatedBy; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
