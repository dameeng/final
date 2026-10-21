package com.mbc.puf.pm.entity;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import org.hibernate.annotations.Generated;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** 예지보전 기준 변경 이력 (테이블: pm_threshold_history) */
@Entity
@Table(name = "pm_threshold_history")
public class PmThresholdHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "threshold_id")
    private Long thresholdId;

    @Column(name = "old_min")
    private BigDecimal oldMin;

    @Column(name = "new_min")
    private BigDecimal newMin;

    @Column(name = "changed_by")
    private Long changedBy;

    @Generated   // DB 기본값(NOW())으로 INSERT 시 채워진다
    @Column(name = "changed_at", insertable = false, updatable = false)
    private LocalDateTime changedAt;

    public PmThresholdHistory() {
    }

    public PmThresholdHistory(Long thresholdId, BigDecimal oldMin, BigDecimal newMin, Long changedBy) {
        this.thresholdId = thresholdId;
        this.oldMin = oldMin;
        this.newMin = newMin;
        this.changedBy = changedBy;
    }

    public Long getId() {
        return id;
    }

    public Long getThresholdId() {
        return thresholdId;
    }

    public BigDecimal getOldMin() {
        return oldMin;
    }

    public BigDecimal getNewMin() {
        return newMin;
    }

    public Long getChangedBy() {
        return changedBy;
    }

    public LocalDateTime getChangedAt() {
        return changedAt;
    }
}
