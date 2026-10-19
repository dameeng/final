package com.mbc.puf.control.entity;

import com.mbc.puf.common.enums.TransferAgency;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import org.hibernate.annotations.Generated;

/** 통제정보 이관 기록 (테이블: ctrl_transfer) */
@Entity
@Table(name = "ctrl_transfer")
public class CtrlTransfer {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "event_id", nullable = false)
    private Long eventId;

    @Enumerated(EnumType.STRING)
    @Column(name = "agency", nullable = false)
    private TransferAgency agency;

    @Column(name = "memo", columnDefinition = "TEXT")
    private String memo;

    @Column(name = "manager_id", nullable = false)
    private Long managerId;

    @Generated
    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    public CtrlTransfer() {}

    public Long getId() { return id; }

    public Long getEventId() { return eventId; }
    public void setEventId(Long eventId) { this.eventId = eventId; }

    public TransferAgency getAgency() { return agency; }
    public void setAgency(TransferAgency agency) { this.agency = agency; }

    public String getMemo() { return memo; }
    public void setMemo(String memo) { this.memo = memo; }

    public Long getManagerId() { return managerId; }
    public void setManagerId(Long managerId) { this.managerId = managerId; }

    public LocalDateTime getCreatedAt() { return createdAt; }
}
