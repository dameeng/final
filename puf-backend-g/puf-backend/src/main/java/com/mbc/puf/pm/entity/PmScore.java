package com.mbc.puf.pm.entity;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** 고장 위험 점수 (테이블: pm_score). 0~100점. predicted_at = 계산에 쓴 측정값의 측정 시각 */
@Entity
@Table(name = "pm_score")
public class PmScore {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "equip_id")
    private Long equipId;

    @Column(name = "score")
    private BigDecimal score;

    @Column(name = "predicted_at")
    private LocalDateTime predictedAt;

    public PmScore() {
    }

    public PmScore(Long equipId, BigDecimal score, LocalDateTime predictedAt) {
        this.equipId = equipId;
        this.score = score;
        this.predictedAt = predictedAt;
    }

    public Long getId() {
        return id;
    }

    public Long getEquipId() {
        return equipId;
    }

    public BigDecimal getScore() {
        return score;
    }

    public LocalDateTime getPredictedAt() {
        return predictedAt;
    }
}
