package com.mbc.puf.plate.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/** review_status=PENDING인 번호판 인식 결과 (판별대기 목록).
 *  imagePath는 FastAPI가 캡처 이미지를 같이 보냈을 때만 값이 있음(upload-dir 기준 상대경로, 없으면 null) */
public class PlateLogPendingItem {

    private final Long id;
    private final Long cameraId;
    private final Long underpassId;
    private final String detectedNum;
    private final BigDecimal confidence;
    private final String imagePath;
    private final LocalDateTime reviewDeadline;
    private final LocalDateTime detectedAt;

    public PlateLogPendingItem(Long id, Long cameraId, Long underpassId, String detectedNum, BigDecimal confidence,
                               String imagePath, LocalDateTime reviewDeadline, LocalDateTime detectedAt) {
        this.id = id;
        this.cameraId = cameraId;
        this.underpassId = underpassId;
        this.detectedNum = detectedNum;
        this.confidence = confidence;
        this.imagePath = imagePath;
        this.reviewDeadline = reviewDeadline;
        this.detectedAt = detectedAt;
    }

    public Long getId() { return id; }
    public Long getCameraId() { return cameraId; }
    public Long getUnderpassId() { return underpassId; }
    public String getDetectedNum() { return detectedNum; }
    public BigDecimal getConfidence() { return confidence; }
    public String getImagePath() { return imagePath; }
    public LocalDateTime getReviewDeadline() { return reviewDeadline; }
    public LocalDateTime getDetectedAt() { return detectedAt; }
}