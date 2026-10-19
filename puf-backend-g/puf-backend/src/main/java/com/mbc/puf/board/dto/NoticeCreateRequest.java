package com.mbc.puf.board.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** 공지사항 등록 요청 */
public class NoticeCreateRequest {

    @NotBlank(message = "제목은 필수입니다.")
    @Size(max = 200, message = "제목은 200자 이하여야 합니다.")   // notice.title VARCHAR(200)
    private String title;

    @NotBlank(message = "내용은 필수입니다.")
    private String content;

    private boolean important;   // 안 보내면 false

    public NoticeCreateRequest() {
    }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }

    public boolean isImportant() { return important; }
    public void setImportant(boolean important) { this.important = important; }
}
