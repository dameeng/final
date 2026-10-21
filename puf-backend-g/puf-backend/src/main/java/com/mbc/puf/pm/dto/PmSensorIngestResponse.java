package com.mbc.puf.pm.dto;

import java.math.BigDecimal;

import com.mbc.puf.pm.entity.PmLevel;

/** 측정값 넣은 결과: 새로 계산된 점수와 단계, 점검 대상이 생겼거나 갱신됐으면 그 번호 */
public record PmSensorIngestResponse(Long equipId, BigDecimal score, PmLevel level, Long eventId) {
}
