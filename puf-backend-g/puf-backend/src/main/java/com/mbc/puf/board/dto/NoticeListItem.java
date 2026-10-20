package com.mbc.puf.board.dto;

import java.time.LocalDateTime;

import com.fasterxml.jackson.annotation.JsonFormat;

/** 공지사항 목록의 한 항목. 목록에서는 본문(content)을 내려주지 않는다 */
public class NoticeListItem {

    private Long id;
    private String title;
    private boolean important;
    private String authorName;   // manager.name (작성 관리자 이름)
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd HH:mm")
    private LocalDateTime createdAt;

    public NoticeListItem() {
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public boolean isImportant() { return important; }
    public void setImportant(boolean important) { this.important = important; }

    public String getAuthorName() { return authorName; }
    public void setAuthorName(String authorName) { this.authorName = authorName; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}