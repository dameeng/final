package com.mbc.puf.internal.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import com.mbc.puf.common.enums.RecognitionStatus;
import com.mbc.puf.common.enums.ReviewStatus;

/** plate_log 테이블 INSERT용 (내부용). correctedNum/reviewedBy/reviewedAt은 이 단계에서 항상 null.
 *  imagePath는 FastAPI가 이미지를 같이 보냈을 때만 값이 있고(upload-dir 기준 상대경로), 없으면 null */
public class PlateLog {

    private Long id;
    private Long cameraId;
    private String detectedNum;
    private BigDecimal confidence;
    private String imagePath;
    private RecognitionStatus recognitionStatus;
    private Long carId;
    private ReviewStatus reviewStatus;
    private LocalDateTime reviewDeadline;
    private LocalDateTime detectedAt;

    public PlateLog() {
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getCameraId() { return cameraId; }
    public void setCameraId(Long cameraId) { this.cameraId = cameraId; }

    public String getDetectedNum() { return detectedNum; }
    public void setDetectedNum(String detectedNum) { this.detectedNum = detectedNum; }

    public BigDecimal getConfidence() { return confidence; }
    public void setConfidence(BigDecimal confidence) { this.confidence = confidence; }

    public String getImagePath() { return imagePath; }
    public void setImagePath(String imagePath) { this.imagePath = imagePath; }

    public RecognitionStatus getRecognitionStatus() { return recognitionStatus; }
    public void setRecognitionStatus(RecognitionStatus recognitionStatus) { this.recognitionStatus = recognitionStatus; }

    public Long getCarId() { return carId; }
    public void setCarId(Long carId) { this.carId = carId; }

    public ReviewStatus getReviewStatus() { return reviewStatus; }
    public void setReviewStatus(ReviewStatus reviewStatus) { this.reviewStatus = reviewStatus; }

    public LocalDateTime getReviewDeadline() { return reviewDeadline; }
    public void setReviewDeadline(LocalDateTime reviewDeadline) { this.reviewDeadline = reviewDeadline; }

    public LocalDateTime getDetectedAt() { return detectedAt; }
    public void setDetectedAt(LocalDateTime detectedAt) { this.detectedAt = detectedAt; }
}