package com.mbc.puf.pm.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import com.mbc.puf.pm.entity.PmEquipmentType;
import com.mbc.puf.pm.entity.PmEventStatus;
import com.mbc.puf.pm.entity.PmLevel;

/** 점검 대상(점검 대기 화면) 한 줄 (NativeSql 로 채운다). currentScore = 지금 최신 점수 */
public class PmEventItem {

    private Long eventId;
    private Long equipId;
    private PmEquipmentType type;
    private Long underpassId;
    private String underpassName;
    private PmLevel level;
    private BigDecimal score;
    private BigDecimal currentScore;
    private String reason;
    private PmEventStatus status;
    private LocalDateTime createdAt;
    private String lastAction;
    private LocalDateTime lastActionAt;

    public PmEventItem() {
    }

    public String getCode() {
        return type == null || underpassId == null ? null : String.format("%s-%02d", type.getCodePrefix(), underpassId);
    }

    public String getTypeLabel() {
        return type == null ? null : type.getLabel();
    }

    public String getLevelLabel() {
        return level == null ? null : level.getDbValue();
    }

    public String getStatusLabel() {
        return status == null ? null : status.getLabel();
    }

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
    public PmLevel getLevel() { return level; }
    public void setLevel(PmLevel level) { this.level = level; }
    public BigDecimal getScore() { return score; }
    public void setScore(BigDecimal score) { this.score = score; }
    public BigDecimal getCurrentScore() { return currentScore; }
    public void setCurrentScore(BigDecimal currentScore) { this.currentScore = currentScore; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
    public PmEventStatus getStatus() { return status; }
    public void setStatus(PmEventStatus status) { this.status = status; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public String getLastAction() { return lastAction; }
    public void setLastAction(String lastAction) { this.lastAction = lastAction; }
    public LocalDateTime getLastActionAt() { return lastActionAt; }
    public void setLastActionAt(LocalDateTime lastActionAt) { this.lastActionAt = lastActionAt; }
}
