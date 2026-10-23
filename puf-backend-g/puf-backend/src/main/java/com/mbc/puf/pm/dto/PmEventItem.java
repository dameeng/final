package com.mbc.puf.pm.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import com.mbc.puf.common.enums.PmEquipmentType;
import com.mbc.puf.common.enums.PmEventStatus;
import com.mbc.puf.common.enums.PmLevel;

/** 점검 대기(예지보전 이벤트) 1행 (GET /api/pm/events) */
public class PmEventItem {

    private Long eventId;
    private Long equipId;
    private PmEquipmentType type;
    private Long underpassId;
    private String underpassName;
    private Long regionId;
    private PmLevel level;               // 넘은 단계 (주의 → 위험으로 오르면 올라감)
    private BigDecimal score;            // 이벤트 발생(또는 단계 상승) 시점 점수
    private PmEventStatus status;
    private LocalDateTime createdAt;     // 발생 시각
    private BigDecimal currentScore;     // 지금 점수 (가장 최근 pm_score)
    private PmLevel currentLevel;

    public PmEventItem() {
    }

    public String getCode() {
        return PmCodes.code(type, equipId);
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

    public Long getRegionId() { return regionId; }
    public void setRegionId(Long regionId) { this.regionId = regionId; }

    public PmLevel getLevel() { return level; }
    public void setLevel(PmLevel level) { this.level = level; }

    public BigDecimal getScore() { return score; }
    public void setScore(BigDecimal score) { this.score = score; }

    public PmEventStatus getStatus() { return status; }
    public void setStatus(PmEventStatus status) { this.status = status; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public BigDecimal getCurrentScore() { return currentScore; }
    public void setCurrentScore(BigDecimal currentScore) { this.currentScore = currentScore; }

    public PmLevel getCurrentLevel() { return currentLevel; }
    public void setCurrentLevel(PmLevel currentLevel) { this.currentLevel = currentLevel; }
}
