package com.mbc.puf.underpass.dto;

import com.mbc.puf.common.enums.DisplayMessageType;

import jakarta.validation.constraints.NotNull;

/** 전광판 조작 요청. 실제 장치 제어는 없고 조작 기록(display_log)만 남긴다 */
public class DisplayLogRequest {

    @NotNull(message = "표출할 메시지 종류를 선택해주세요.")
    private DisplayMessageType messageType;

    public DisplayLogRequest() {
    }

    public DisplayMessageType getMessageType() { return messageType; }
    public void setMessageType(DisplayMessageType messageType) { this.messageType = messageType; }
}
