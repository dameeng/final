package com.mbc.puf.pm.dto;

import java.math.BigDecimal;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

/** 예지보전 기준 한 단계 수정: 이 점수 이상이면 그 단계 */
public record PmThresholdUpdateRequest(
        @NotNull(message = "기준 점수를 입력하세요.")
        @DecimalMin(value = "0", message = "기준 점수는 0 이상이어야 합니다.")
        @DecimalMax(value = "100", message = "기준 점수는 100 이하여야 합니다.")
        BigDecimal minScore) {
}
