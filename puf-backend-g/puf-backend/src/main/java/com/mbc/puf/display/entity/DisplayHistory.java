package com.mbc.puf.display.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import org.hibernate.annotations.Generated;

/** 전광판 페이지 수정 이력 (테이블: display_history) */
@Entity
@Table(name = "display_history")
public class DisplayHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "page_id", nullable = false)
    private Long pageId;

    @Column(name = "event_id")
    private Long eventId;   // 차단/해제 이벤트가 원인이면 값 있음, 수동 수정이면 NULL

    @Column(name = "old_content", length = 100)
    private String oldContent;   // 최초 생성이면 NULL

    @Column(name = "new_content", nullable = false, length = 100)
    private String newContent;

    @Column(name = "changed_by", nullable = false)
    private Long changedBy;

    @Generated
    @Column(name = "changed_at", insertable = false, updatable = false)
    private LocalDateTime changedAt;

    public DisplayHistory() {}

    public Long getId() { return id; }

    public Long getPageId() { return pageId; }
    public void setPageId(Long pageId) { this.pageId = pageId; }

    public Long getEventId() { return eventId; }
    public void setEventId(Long eventId) { this.eventId = eventId; }

    public String getOldContent() { return oldContent; }
    public void setOldContent(String oldContent) { this.oldContent = oldContent; }

    public String getNewContent() { return newContent; }
    public void setNewContent(String newContent) { this.newContent = newContent; }

    public Long getChangedBy() { return changedBy; }
    public void setChangedBy(Long changedBy) { this.changedBy = changedBy; }

    public LocalDateTime getChangedAt() { return changedAt; }
}
