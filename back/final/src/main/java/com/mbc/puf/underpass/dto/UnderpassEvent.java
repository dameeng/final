package com.mbc.puf.underpass.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import com.mbc.puf.common.enums.RiskLevel;
import com.mbc.puf.common.enums.UnderpassEventType;

/** underpass_event 테이블 INSERT용 (내부용). BLOCK/RELEASE에서는 riskLevel/riskScoreAtEvent가 null */
public class UnderpassEvent {

    private Long id;
    private Long underpassId;
    private UnderpassEventType eventType;
    private RiskLevel riskLevel;
    private BigDecimal riskScoreAtEvent;
    private Long operatorId;
    private LocalDateTime createdAt;

    public UnderpassEvent() {
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getUnderpassId() { return underpassId; }
    public void setUnderpassId(Long underpassId) { this.underpassId = underpassId; }

    public UnderpassEventType getEventType() { return eventType; }
    public void setEventType(UnderpassEventType eventType) { this.eventType = eventType; }

    public RiskLevel getRiskLevel() { return riskLevel; }
    public void setRiskLevel(RiskLevel riskLevel) { this.riskLevel = riskLevel; }

    public BigDecimal getRiskScoreAtEvent() { return riskScoreAtEvent; }
    public void setRiskScoreAtEvent(BigDecimal riskScoreAtEvent) { this.riskScoreAtEvent = riskScoreAtEvent; }

    public Long getOperatorId() { return operatorId; }
    public void setOperatorId(Long operatorId) { this.operatorId = operatorId; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
