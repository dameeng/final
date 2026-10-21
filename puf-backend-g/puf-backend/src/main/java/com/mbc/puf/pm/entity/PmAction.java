package com.mbc.puf.pm.entity;

import java.time.LocalDateTime;

import org.hibernate.annotations.Generated;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** 조치 기록 (테이블: pm_action). 점검 이력 화면과 리포트에 쓰인다 */
@Entity
@Table(name = "pm_action")
public class PmAction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "event_id")
    private Long eventId;

    @Column(name = "content")
    private String content;

    @Column(name = "manager_id")
    private Long managerId;

    @Generated
    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    public PmAction() {
    }

    public PmAction(Long eventId, String content, Long managerId) {
        this.eventId = eventId;
        this.content = content;
        this.managerId = managerId;
    }

    public Long getId() {
        return id;
    }

    public Long getEventId() {
        return eventId;
    }

    public String getContent() {
        return content;
    }

    public Long getManagerId() {
        return managerId;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }
}
