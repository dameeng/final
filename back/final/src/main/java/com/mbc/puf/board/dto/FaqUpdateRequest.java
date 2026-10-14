package com.mbc.puf.board.dto;

import jakarta.validation.constraints.NotBlank;

/** FAQ 수정 요청 (질문/답변 전체 교체) */
public class FaqUpdateRequest {

    @NotBlank(message = "질문은 필수입니다.")
    private String question;

    @NotBlank(message = "답변은 필수입니다.")
    private String answer;

    public FaqUpdateRequest() {
    }

    public String getQuestion() { return question; }
    public void setQuestion(String question) { this.question = question; }

    public String getAnswer() { return answer; }
    public void setAnswer(String answer) { this.answer = answer; }
}
