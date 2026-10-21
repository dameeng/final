package com.mbc.puf.pm.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Map;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

/**
 * 측정값 넣기 (FastAPI·센서·시연 도구 → 스프링 내부 API).
 *   {"equipId": 39, "values": {"motor_current_rise": 34, "vibration_index": 5.8}}
 * recordedAt 을 비우면 DB 현재 시각. 항목 이름은 GET /api/pm/rules 에 나오는 metric 만 받는다.
 */
public record PmSensorIngestRequest(
        @NotNull(message = "설비 번호(equipId)를 입력하세요.") Long equipId,
        LocalDateTime recordedAt,
        @NotEmpty(message = "측정값(values)을 하나 이상 입력하세요.") Map<String, BigDecimal> values) {
}
