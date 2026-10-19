package com.mbc.puf.display.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** 전광판 페이지 생성/수정 요청 */
public class DisplayPageSaveRequest {

    private Long presetId;   // 프리셋 선택 시 (직접 입력이면 null)

    @NotBlank(message = "표출 문구는 필수입니다.")
    @Size(max = 100, message = "표출 문구는 100자 이내로 입력해 주세요.")
    private String content;

    public Long getPresetId() { return presetId; }
    public void setPresetId(Long presetId) { this.presetId = presetId; }

    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
}
