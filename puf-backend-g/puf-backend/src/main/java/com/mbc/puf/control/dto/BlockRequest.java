package com.mbc.puf.control.dto;

import jakarta.validation.constraints.Size;

/** 지하차도 차단 요청 (사유는 선택) */
public class BlockRequest {

    private Long presetId;   // 프리셋 선택 시 (직접 입력이면 null)

    @Size(max = 200, message = "사유는 200자 이내로 입력해 주세요.")
    private String reason;   // 직접 입력 시 (프리셋 선택이면 null)

    public Long getPresetId() { return presetId; }
    public void setPresetId(Long presetId) { this.presetId = presetId; }

    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
}
