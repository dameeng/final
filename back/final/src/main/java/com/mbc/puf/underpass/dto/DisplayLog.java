package com.mbc.puf.underpass.dto;

import java.time.LocalDateTime;

import com.mbc.puf.common.enums.DisplayMessageType;

/** display_log 테이블 INSERT용 (내부용) */
public class DisplayLog {

    private Long id;
    private Long underpassId;
    private DisplayMessageType messageType;
    private Long operatorId;
    private LocalDateTime createdAt;

    public DisplayLog() {
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getUnderpassId() { return underpassId; }
    public void setUnderpassId(Long underpassId) { this.underpassId = underpassId; }

    public DisplayMessageType getMessageType() { return messageType; }
    public void setMessageType(DisplayMessageType messageType) { this.messageType = messageType; }

    public Long getOperatorId() { return operatorId; }
    public void setOperatorId(Long operatorId) { this.operatorId = operatorId; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
