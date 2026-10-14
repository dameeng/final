package com.mbc.puf.board.dto;

import java.time.LocalDateTime;

/** notice 테이블 INSERT/UPDATE용 (내부용) */
public class Notice {

    private Long id;
    private String title;
    private String content;
    private boolean important;   // notice.is_important
    private Long authorId;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public Notice() {
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }

    public boolean isImportant() { return important; }
    public void setImportant(boolean important) { this.important = important; }

    public Long getAuthorId() { return authorId; }
    public void setAuthorId(Long authorId) { this.authorId = authorId; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
