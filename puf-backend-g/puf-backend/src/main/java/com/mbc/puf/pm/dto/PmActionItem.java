package com.mbc.puf.pm.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import com.mbc.puf.pm.entity.PmEquipmentType;
import com.mbc.puf.pm.entity.PmEventStatus;

/** 점검 이력(조치 기록) 한 줄 (NativeSql 로 채운다). 화면의 "72 → 24" = eventScore → currentScore */
public class PmActionItem {

    private Long actionId;
    private Long eventId;
    private Long equipId;
    private PmEquipmentType type;
    private Long underpassId;
    private String underpassName;
    private String reason;
    private String content;
    private Long managerId;
    private String managerLoginId;
    private LocalDateTime createdAt;
    private BigDecimal eventScore;
    private BigDecimal currentScore;
    private PmEventStatus eventStatus;

    public PmActionItem() {
    }

    public String getCode() {
        return type == null || underpassId == null ? null : String.format("%s-%02d", type.getCodePrefix(), underpassId);
    }

    public String getTypeLabel() {
        return type == null ? null : type.getLabel();
    }

    public String getEventStatusLabel() {
        return eventStatus == null ? null : eventStatus.getLabel();
    }

    public Long getActionId() { return actionId; }
    public void setActionId(Long actionId) { this.actionId = actionId; }
    public Long getEventId() { return eventId; }
    public void setEventId(Long eventId) { this.eventId = eventId; }
    public Long getEquipId() { return equipId; }
    public void setEquipId(Long equipId) { this.equipId = equipId; }
    public PmEquipmentType getType() { return type; }
    public void setType(PmEquipmentType type) { this.type = type; }
    public Long getUnderpassId() { return underpassId; }
    public void setUnderpassId(Long underpassId) { this.underpassId = underpassId; }
    public String getUnderpassName() { return underpassName; }
    public void setUnderpassName(String underpassName) { this.underpassName = underpassName; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
    public Long getManagerId() { return managerId; }
    public void setManagerId(Long managerId) { this.managerId = managerId; }
    public String getManagerLoginId() { return managerLoginId; }
    public void setManagerLoginId(String managerLoginId) { this.managerLoginId = managerLoginId; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public BigDecimal getEventScore() { return eventScore; }
    public void setEventScore(BigDecimal eventScore) { this.eventScore = eventScore; }
    public BigDecimal getCurrentScore() { return currentScore; }
    public void setCurrentScore(BigDecimal currentScore) { this.currentScore = currentScore; }
    public PmEventStatus getEventStatus() { return eventStatus; }
    public void setEventStatus(PmEventStatus eventStatus) { this.eventStatus = eventStatus; }
}
