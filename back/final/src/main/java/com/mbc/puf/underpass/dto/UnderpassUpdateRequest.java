package com.mbc.puf.underpass.dto;

import java.math.BigDecimal;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

/** 지하차도 정보 수정 요청. current_status는 여기서 바꾸지 않는다(차단/해제 도메인 전용) */
public class UnderpassUpdateRequest {

    @NotBlank(message = "이름은 필수입니다.")
    @Size(max = 100, message = "이름은 100자 이하여야 합니다.")
    private String name;

    @NotNull(message = "지역을 선택해주세요.")
    private Long regionId;

    @Size(max = 255, message = "도로명주소는 255자 이하여야 합니다.")
    private String roadAddress;

    @NotNull(message = "위도는 필수입니다.")
    private BigDecimal latitude;

    @NotNull(message = "경도는 필수입니다.")
    private BigDecimal longitude;

    private BigDecimal heightM;     // 높이(m, 층고) — AI 모델 입력값
    private BigDecimal lengthM;

    @PositiveOrZero(message = "침수 이력 횟수는 0 이상이어야 합니다.")
    private int floodHistoryCount;

    public UnderpassUpdateRequest() {
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

    public int getFloodHistoryCount() { return floodHistoryCount; }
    public void setFloodHistoryCount(int floodHistoryCount) { this.floodHistoryCount = floodHistoryCount; }
}