package com.mbc.puf.pm.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import com.mbc.puf.pm.entity.PmEquipmentType;
import com.mbc.puf.pm.entity.PmEventStatus;
import com.mbc.puf.pm.entity.PmLevel;

/**
 * 설비 목록·Top5 한 줄 (NativeSql 로 채운다).
 * code 는 화면용 이름: 종류 앞글자 + 지하차도 번호 (예: 13번 지하차도 배수펌프 → P-13).
 * change 는 24시간 전 점수와의 차이 (화면의 ▲ 34).
 */
public class PmEquipmentItem {

    private Long equipId;
    private PmEquipmentType type;
    private Long underpassId;
    private String underpassName;
    private Long regionId;
    private BigDecimal score;
    private BigDecimal prevScore;
    private LocalDateTime predictedAt;
    private PmLevel level;
    private Long openEventId;
    private PmEventStatus openEventStatus;

    public PmEquipmentItem() {
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

    public String getOpenEventStatusLabel() {
        return openEventStatus == null ? null : openEventStatus.getLabel();
    }

    public BigDecimal getChange() {
        return score == null || prevScore == null ? null : score.subtract(prevScore);
    }

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
    public BigDecimal getScore() { return score; }
    public void setScore(BigDecimal score) { this.score = score; }
    public BigDecimal getPrevScore() { return prevScore; }
    public void setPrevScore(BigDecimal prevScore) { this.prevScore = prevScore; }
    public LocalDateTime getPredictedAt() { return predictedAt; }
    public void setPredictedAt(LocalDateTime predictedAt) { this.predictedAt = predictedAt; }
    public PmLevel getLevel() { return level; }
    public void setLevel(PmLevel level) { this.level = level; }
    public Long getOpenEventId() { return openEventId; }
    public void setOpenEventId(Long openEventId) { this.openEventId = openEventId; }
    public PmEventStatus getOpenEventStatus() { return openEventStatus; }
    public void setOpenEventStatus(PmEventStatus openEventStatus) { this.openEventStatus = openEventStatus; }
}
