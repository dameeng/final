package com.mbc.puf.underpass.dto;

import jakarta.validation.constraints.NotNull;

/** 지하차도의 입구/출구 카메라 지정 요청 */
public class CameraAssignRequest {

    @NotNull(message = "cameraId는 필수입니다.")
    private Long cameraId;

    public CameraAssignRequest() {
    }

    public Long getCameraId() { return cameraId; }
    public void setCameraId(Long cameraId) { this.cameraId = cameraId; }
}
