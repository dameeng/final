package com.mbc.puf.underpass.dto;

import java.time.LocalDateTime;

import com.mbc.puf.common.enums.TransitStatus;

/** 잔류차량 등 지하차도 통과 기록 응답 */
public class TransitResponse {

    private final Long id;
    private final Long underpassId;
    private final String carNum;
    private final TransitStatus status;
    private final LocalDateTime entryAt;
    private final LocalDateTime exitAt;

    public TransitResponse(Long id, Long underpassId, String carNum, TransitStatus status,
                           LocalDateTime entryAt, LocalDateTime exitAt) {
        this.id = id;
        this.underpassId = underpassId;
        this.carNum = carNum;
        this.status = status;
        this.entryAt = entryAt;
        this.exitAt = exitAt;
    }

    public Long getId() { return id; }
    public Long getUnderpassId() { return underpassId; }
    public String getCarNum() { return carNum; }
    public TransitStatus getStatus() { return status; }
    public LocalDateTime getEntryAt() { return entryAt; }
    public LocalDateTime getExitAt() { return exitAt; }
}
