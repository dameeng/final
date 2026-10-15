package com.mbc.puf.underpass.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import com.mbc.puf.common.enums.RiskLevel;
import com.mbc.puf.common.enums.UnderpassEventType;

/** 제어이력(MP-16 일부) 응답. display_log는 아직 없어서 포함하지 않는다 */
public class UnderpassEventResponse {

    private final Long id;
    private final Long underpassId;
    private final UnderpassEventType eventType;
    private final RiskLevel riskLevel;
    private final BigDecimal riskScoreAtEvent;
    private final Long operatorId;
    //private final String operatorName;   // manager.name (BLOCK/RELEASE일 때만 값 있음)
    private final LocalDateTime createdAt;

    public UnderpassEventResponse(Long id, Long underpassId, UnderpassEventType eventType, RiskLevel riskLevel,
                                  BigDecimal riskScoreAtEvent, Long operatorId,
                                  LocalDateTime createdAt) {
        this.id = id;
        this.underpassId = underpassId;
        this.eventType = eventType;
        this.riskLevel = riskLevel;
        this.riskScoreAtEvent = riskScoreAtEvent;
        this.operatorId = operatorId;
        //this.operatorName = operatorName;
        this.createdAt = createdAt;
    }

    public Long getId() { return id; }
    public Long getUnderpassId() { return underpassId; }
    public UnderpassEventType getEventType() { return eventType; }
    public RiskLevel getRiskLevel() { return riskLevel; }
    public BigDecimal getRiskScoreAtEvent() { return riskScoreAtEvent; }
    public Long getOperatorId() { return operatorId; }
    //public String getOperatorName() { return operatorName; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
