package com.mbc.puf.underpass.dto;

import java.math.BigDecimal;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

/** 지하차도 등록 요청. current_status는 등록 시 항상 NORMAL로 고정되며(차단/해제 도메인에서만 변경),
 *  상·하행 입출구 카메라는 PUT /api/underpasses/{id}/gate-cameras 로 따로 지정한다 */
public class UnderpassCreateRequest {

    @NotBlank(message = "이름은 필수입니다.")
    @Size(max = 100, message = "이름은 100자 이하여야 합니다.")   // underpass.name VARCHAR(100)
    private String name;

    @NotNull(message = "지역을 선택해주세요.")
    private Long regionId;

    @Size(max = 255, message = "도로명주소는 255자 이하여야 합니다.")
    private String roadAddress;

    @NotNull(message = "위도는 필수입니다.")
    private BigDecimal latitude;

    @NotNull(message = "경도는 필수입니다.")
    private BigDecimal longitude;

    private BigDecimal heightM;     // 높이(m, 층고), 선택 — AI 모델 입력값(3.5~5.0m 대)
    private BigDecimal lengthM;     // 길이(m), 선택
    private BigDecimal widthM;      // 폭(m), 선택
    private Integer lanes;          // 차로수, 선택
    @Size(max = 10, message = "안전등급은 10자 이하여야 합니다.")
    private String safetyGrade;     // 안전등급(A~E, 미실시/불명은 UNKNOWN), 선택
    private BigDecimal riverDistM;  // 가까운 하천까지 직선거리(m), 선택 — AI 모델 입력값
    private BigDecimal seaDistM;    // 바다까지 직선거리(m), 선택 — AI 모델 입력값

    @PositiveOrZero(message = "침수 이력 횟수는 0 이상이어야 합니다.")
    private int floodHistoryCount;   // 안 보내면 0

    public UnderpassCreateRequest() {
    }

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

    public BigDecimal getWidthM() { return widthM; }
    public void setWidthM(BigDecimal widthM) { this.widthM = widthM; }

    public Integer getLanes() { return lanes; }
    public void setLanes(Integer lanes) { this.lanes = lanes; }

    public String getSafetyGrade() { return safetyGrade; }
    public void setSafetyGrade(String safetyGrade) { this.safetyGrade = safetyGrade; }

    public BigDecimal getRiverDistM() { return riverDistM; }
    public void setRiverDistM(BigDecimal riverDistM) { this.riverDistM = riverDistM; }

    public BigDecimal getSeaDistM() { return seaDistM; }
    public void setSeaDistM(BigDecimal seaDistM) { this.seaDistM = seaDistM; }

    public int getFloodHistoryCount() { return floodHistoryCount; }
    public void setFloodHistoryCount(int floodHistoryCount) { this.floodHistoryCount = floodHistoryCount; }
}