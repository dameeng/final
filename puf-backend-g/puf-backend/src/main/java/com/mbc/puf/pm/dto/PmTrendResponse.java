package com.mbc.puf.pm.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/** 설비 상세 그래프: 점수 추이 + 측정 항목별 추이 (항목 이름 → 시각순 값) */
public record PmTrendResponse(List<Point> scores, Map<String, List<Point>> metrics) {

    public record Point(LocalDateTime at, BigDecimal value) {
    }
}
