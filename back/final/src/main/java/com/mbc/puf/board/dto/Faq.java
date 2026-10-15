package com.mbc.puf.board.dto;

import java.time.LocalDateTime;

/** faq 테이블 INSERT/UPDATE용 (내부용) */
public class Faq {

    private Long id;
    private String question;
    private String answer;
    private Long authorId;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public Faq() {
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getQuestion() { return question; }
    public void setQuestion(String question) { this.question = question; }

    public String getAnswer() { return answer; }
    public void setAnswer(String answer) { this.answer = answer; }

    public Long getAuthorId() { return authorId; }
    public void setAuthorId(Long authorId) { this.authorId = authorId; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
