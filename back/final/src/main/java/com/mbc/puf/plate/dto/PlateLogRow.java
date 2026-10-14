package com.mbc.puf.plate.dto;

/** plate_log 한 건 + 소속 지하차도 id/카메라 id (지역 권한 확인, 재매칭·재알림용 내부 조회 결과) */
public class PlateLogRow {

    private Long id;
    private Long underpassId;
    private Long cameraId;

    public PlateLogRow() {
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getUnderpassId() { return underpassId; }
    public void setUnderpassId(Long underpassId) { this.underpassId = underpassId; }

    public Long getCameraId() { return cameraId; }
    public void setCameraId(Long cameraId) { this.cameraId = cameraId; }
}
