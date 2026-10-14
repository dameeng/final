package com.mbc.puf.underpass.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import com.mbc.puf.common.enums.RiskLevel;
import com.mbc.puf.common.enums.UnderpassCurrentStatus;

/** 지하차도 상세 응답. currentStatus/currentBlockEventId/currentRiskLevel/entryCameraId/exitCameraId는
 *  조회 전용(이 CRUD로는 변경 불가) */
public class UnderpassDetailResponse {

    private Long id;
    private String name;
    private Long regionId;
    private String roadAddress;
    private BigDecimal latitude;
    private BigDecimal longitude;
    private BigDecimal heightM;     // 높이(m, 층고) — AI 모델 입력값
    private BigDecimal lengthM;
    private int floodHistoryCount;
    private UnderpassCurrentStatus currentStatus;
    private Long currentBlockEventId;
    private RiskLevel currentRiskLevel;
    private Long entryCameraId;
    private Long exitCameraId;
    private LocalDateTime createdAt;

    public UnderpassDetailResponse() {
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public Long getRegionId() { return regionId; }
    public void setRegionId(Long regionId) { this.regionId = regionId; }

    public String getRoadAddress() { return roadAddress; }
    public void setRoadAddress(String roadAddress) { this.roadAddress = roadAddress; }

    public BigDecimal getLatitude() { return latitude; }
    public void setLatitude(BigDecimal latitude) { this.latitude = latitude; }

    public BigDecimal getLongitude() { return longitude; }
    public void setLongitude(BigDecimal longitude) { this.longitude = longitude; }

    public BigDecimal getHeightM() { return heightM; }
    public void setHeightM(BigDecimal heightM) { this.heightM = heightM; }

    public BigDecimal getLengthM() { return lengthM; }
    public void setLengthM(BigDecimal lengthM) { this.lengthM = lengthM; }

    public int getFloodHistoryCount() { return floodHistoryCount; }
    public void setFloodHistoryCount(int floodHistoryCount) { this.floodHistoryCount = floodHistoryCount; }

    public UnderpassCurrentStatus getCurrentStatus() { return currentStatus; }
    public void setCurrentStatus(UnderpassCurrentStatus currentStatus) { this.currentStatus = currentStatus; }

    public Long getCurrentBlockEventId() { return currentBlockEventId; }
    public void setCurrentBlockEventId(Long currentBlockEventId) { this.currentBlockEventId = currentBlockEventId; }

    public RiskLevel getCurrentRiskLevel() { return currentRiskLevel; }
    public void setCurrentRiskLevel(RiskLevel currentRiskLevel) { this.currentRiskLevel = currentRiskLevel; }

    public Long getEntryCameraId() { return entryCameraId; }
    public void setEntryCameraId(Long entryCameraId) { this.entryCameraId = entryCameraId; }

    public Long getExitCameraId() { return exitCameraId; }
    public void setExitCameraId(Long exitCameraId) { this.exitCameraId = exitCameraId; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}