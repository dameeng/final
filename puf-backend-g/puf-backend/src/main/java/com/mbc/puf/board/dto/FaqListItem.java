package com.mbc.puf.board.dto;

import java.time.LocalDateTime;

/** FAQ 목록의 한 항목. 목록에서는 답변(answer)을 내려주지 않는다 */
public class FaqListItem {

    private Long id;
    private String question;
    private String authorName;
    private LocalDateTime createdAt;

    public FaqListItem() {
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getQuestion() { return question; }
    public void setQuestion(String question) { this.question = question; }

    public String getAuthorName() { return authorName; }
    public void setAuthorName(String authorName) { this.authorName = authorName; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
