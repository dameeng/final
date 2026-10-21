package com.mbc.puf.pm.entity;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** 설비 측정값 (테이블: pm_sensor). 측정 항목 하나가 한 행. 항목 이름은 PmRules 에 정해 둔 것만 받는다 */
@Entity
@Table(name = "pm_sensor")
public class PmSensor {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "equip_id")
    private Long equipId;

    @Column(name = "metric")
    private String metric;

    @Column(name = "value")
    private BigDecimal value;

    @Column(name = "recorded_at")
    private LocalDateTime recordedAt;

    public PmSensor() {
    }

    public PmSensor(Long equipId, String metric, BigDecimal value, LocalDateTime recordedAt) {
        this.equipId = equipId;
        this.metric = metric;
        this.value = value;
        this.recordedAt = recordedAt;
    }

    public Long getId() {
        return id;
    }

    public Long getEquipId() {
        return equipId;
    }

    public String getMetric() {
        return metric;
    }

    public BigDecimal getValue() {
        return value;
    }

    public LocalDateTime getRecordedAt() {
        return recordedAt;
    }
}
