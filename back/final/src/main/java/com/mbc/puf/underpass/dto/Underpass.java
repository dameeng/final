package com.mbc.puf.underpass.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import com.mbc.puf.common.enums.UnderpassCurrentStatus;

/** underpass 테이블 INSERT/UPDATE/SELECT용 (내부용). current_status/current_block_event_id는
 *  차단·해제 도메인에서만 바뀌므로 이 CRUD에서는 읽기 전용으로만 쓰인다.
 *  height_m(층고)은 AI 모델 입력값으로, 해발고도이던 기존 elevation을 대체함 */
public class Underpass {

    private Long id;
    private String name;
    private Long regionId;
    private String roadAddress;
    private BigDecimal latitude;
    private BigDecimal longitude;
    private BigDecimal heightM;         // 높이(m, 층고 - AI 모델 입력값)
    private BigDecimal lengthM;         // 길이(m)
    private int floodHistoryCount;
    private UnderpassCurrentStatus currentStatus;
    private Long currentBlockEventId;
    private LocalDateTime createdAt;

    public Underpass() {
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

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}