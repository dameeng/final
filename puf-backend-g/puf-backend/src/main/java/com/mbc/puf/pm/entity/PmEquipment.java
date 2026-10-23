package com.mbc.puf.pm.entity;

import com.mbc.puf.common.enums.PmEquipmentType;
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
import org.hibernate.generator.EventType;

/** 예지보전 설비 (테이블: pm_equipment). 지하차도별 CCTV / 전광판 / 배수펌프 / 수위센서 */
@Entity
@Table(name = "pm_equipment")
public class PmEquipment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "underpass_id")
    private Long underpassId;

    @Enumerated(EnumType.STRING)
    @Column(name = "type")
    private PmEquipmentType type;

    @Column(name = "cam_id")
    private Long camId;          // type=CCTV 일 때만

    @Column(name = "its_vms_id")
    private Long itsVmsId;       // type=DISPLAY 일 때만

    @Generated(event = EventType.INSERT)
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

    public void setUnderpassId(Long underpassId) {
        this.underpassId = underpassId;
    }

    public PmEquipmentType getType() {
        return type;
    }

    public void setType(PmEquipmentType type) {
        this.type = type;
    }

    public Long getCamId() {
        return camId;
    }

    public void setCamId(Long camId) {
        this.camId = camId;
    }

    public Long getItsVmsId() {
        return itsVmsId;
    }

    public void setItsVmsId(Long itsVmsId) {
        this.itsVmsId = itsVmsId;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }
}
