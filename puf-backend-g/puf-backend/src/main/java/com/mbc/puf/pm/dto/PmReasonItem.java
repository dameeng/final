package com.mbc.puf.pm.dto;

import java.math.BigDecimal;

/** 설비 상세의 '점수 근거' 한 줄: 항목별 최신 측정값과 그 항목이 보탠 점수 */
public record PmReasonItem(String metric, String label, String unit, BigDecimal value, BigDecimal limit,
                           int weight, BigDecimal points, String status) {
}
