package com.mbc.puf.pm.entity;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** 예지보전 설비 (테이블: pm_equipment). 지하차도마다 CCTV·전광판·배수펌프 1대씩. 여기서는 읽기만 한다 */
@Entity
@Table(name = "pm_equipment")
public class PmEquipment {

    @Id
    @Column(name = "id")
    private Long id;

    @Column(name = "underpass_id")
    private Long underpassId;

    @Enumerated(EnumType.STRING)
    @Column(name = "type")
    private PmEquipmentType type;

    @Column(name = "cam_id")
    private Long camId;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    public PmEquipment() {
    }

    public Long getId() {
        return id;
    }

    public Long getUnderpassId() {
        return underpassId;
    }

    public PmEquipmentType getType() {
        return type;
    }

    public Long getCamId() {
        return camId;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }
}
