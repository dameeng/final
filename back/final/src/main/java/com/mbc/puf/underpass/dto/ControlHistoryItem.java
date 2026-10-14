package com.mbc.puf.underpass.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import com.mbc.puf.common.enums.DisplayMessageType;
import com.mbc.puf.common.enums.RiskLevel;
import com.mbc.puf.common.enums.UnderpassEventType;

/** 제어이력(MP-16) 한 줄, 그리고 대시보드 통합 타임라인에도 재사용된다.
 *  kind="EVENT"면 eventType/riskLevel/riskScoreAtEvent가, kind="DISPLAY"면 messageType이,
 *  kind="ALERT"(대시보드 타임라인 전용)면 나머지가 전부 null인 채 createdAt(발송시각)만 값을 가진다
 *  (서로 배타적). operatorId는 관리자 이름 조인 없이 id만 (테이블에도 id만 있음).
 *  MyBatis 생성자 기반 자동매핑 사용 — SELECT 컬럼 순서가 이 생성자 파라미터 순서와 반드시 일치해야 함 */
public class ControlHistoryItem {

    private final String kind;   // "EVENT" | "DISPLAY" | "ALERT"
    private final Long underpassId;
    private final String underpassName;   // 대시보드 통합 타임라인용: underpass.name
    private final UnderpassEventType eventType;
    private final RiskLevel riskLevel;
    private final BigDecimal riskScoreAtEvent;
    private final DisplayMessageType messageType;
    private final Long operatorId;
    private final LocalDateTime createdAt;

    public ControlHistoryItem(String kind, Long underpassId, String underpassName, UnderpassEventType eventType,
                              RiskLevel riskLevel, BigDecimal riskScoreAtEvent, DisplayMessageType messageType,
                              Long operatorId, LocalDateTime createdAt) {
        this.kind = kind;
        this.underpassId = underpassId;
        this.underpassName = underpassName;
        this.eventType = eventType;
        this.riskLevel = riskLevel;
        this.riskScoreAtEvent = riskScoreAtEvent;
        this.messageType = messageType;
        this.operatorId = operatorId;
        this.createdAt = createdAt;
    }

    public String getKind() { return kind; }
    public Long getUnderpassId() { return underpassId; }
    public String getUnderpassName() { return underpassName; }
    public UnderpassEventType getEventType() { return eventType; }
    public RiskLevel getRiskLevel() { return riskLevel; }
    public BigDecimal getRiskScoreAtEvent() { return riskScoreAtEvent; }
    public DisplayMessageType getMessageType() { return messageType; }
    public Long getOperatorId() { return operatorId; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}