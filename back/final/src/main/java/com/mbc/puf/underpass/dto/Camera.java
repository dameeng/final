package com.mbc.puf.underpass.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import com.mbc.puf.common.enums.CameraRole;

/** underpass_camera 테이블 INSERT/UPDATE/SELECT용 (내부용) */
public class Camera {

    private Long id;
    private Long underpassId;
    private CameraRole cameraRole;
    private String streamUrl;
    private Integer distanceM;
    private BigDecimal latitude;
    private BigDecimal longitude;
    private LocalDateTime createdAt;

    public Camera() {
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getUnderpassId() { return underpassId; }
    public void setUnderpassId(Long underpassId) { this.underpassId = underpassId; }

    public CameraRole getCameraRole() { return cameraRole; }
    public void setCameraRole(CameraRole cameraRole) { this.cameraRole = cameraRole; }

    public String getStreamUrl() { return streamUrl; }
    public void setStreamUrl(String streamUrl) { this.streamUrl = streamUrl; }

    public Integer getDistanceM() { return distanceM; }
    public void setDistanceM(Integer distanceM) { this.distanceM = distanceM; }

    public BigDecimal getLatitude() { return latitude; }
    public void setLatitude(BigDecimal latitude) { this.latitude = latitude; }

    public BigDecimal getLongitude() { return longitude; }
    public void setLongitude(BigDecimal longitude) { this.longitude = longitude; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
