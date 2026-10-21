package com.mbc.puf.pm.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import com.mbc.puf.pm.entity.PmLevel;
import com.mbc.puf.pm.entity.PmThreshold;

/** 설비별 예지보전 기준 한 행 (안전/주의/위험) */
public record PmThresholdItem(Long id, Long equipId, PmLevel level, String levelLabel, BigDecimal minScore,
                              Long updatedBy, LocalDateTime updatedAt) {

    public static PmThresholdItem of(PmThreshold t) {
        return new PmThresholdItem(t.getId(), t.getEquipId(), t.getLevel(), t.getLevel().getDbValue(),
                t.getMinScore(), t.getUpdatedBy(), t.getUpdatedAt());
    }
}
