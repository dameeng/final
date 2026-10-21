package com.mbc.puf.pm.entity;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import org.hibernate.annotations.Generated;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** 점검 대상 (테이블: pm_event). 점수가 주의 이상으로 올라가면 생기고, 상태로 처리 진행을 관리한다 */
@Entity
@Table(name = "pm_event")
public class PmEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "equip_id")
    private Long equipId;

    @Column(name = "level")
    private PmLevel level;

    @Column(name = "score")
    private BigDecimal score;

    @Column(name = "reason")
    private String reason;   // 사유: 점수를 올린 항목 요약 (puf_05 에서 추가한 컬럼)

    @Enumerated(EnumType.STRING)
    @Column(name = "status")
    private PmEventStatus status = PmEventStatus.CHECK_NEEDED;

    @Generated
    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    public PmEvent() {
    }

    public PmEvent(Long equipId, PmLevel level, BigDecimal score, String reason) {
        this.equipId = equipId;
        this.level = level;
        this.score = score;
        this.reason = reason;
    }

    public Long getId() {
        return id;
    }

    public Long getEquipId() {
        return equipId;
    }

    public PmLevel getLevel() {
        return level;
    }

    public void setLevel(PmLevel level) {
        this.level = level;
    }

    public BigDecimal getScore() {
        return score;
    }

    public void setScore(BigDecimal score) {
        this.score = score;
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }

    public PmEventStatus getStatus() {
        return status;
    }

    public void setStatus(PmEventStatus status) {
        this.status = status;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }
}
