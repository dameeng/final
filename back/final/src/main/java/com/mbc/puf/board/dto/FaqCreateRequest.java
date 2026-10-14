package com.mbc.puf.board.dto;

import jakarta.validation.constraints.NotBlank;

/** FAQ 등록 요청 */
public class FaqCreateRequest {

    @NotBlank(message = "질문은 필수입니다.")
    private String question;

    @NotBlank(message = "답변은 필수입니다.")
    private String answer;

    public FaqCreateRequest() {
    }

    public String getQuestion() { return question; }
    public void setQuestion(String question) { this.question = question; }

    public String getAnswer() { return answer; }
    public void setAnswer(String answer) { this.answer = answer; }
}
