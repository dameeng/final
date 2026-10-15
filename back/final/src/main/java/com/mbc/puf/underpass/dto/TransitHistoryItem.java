package com.mbc.puf.underpass.dto;

import java.time.LocalDateTime;

import com.mbc.puf.common.enums.TransitStatus;

/** 통과 이력 조회 응답 (시설 전체/지역 단위 조회용이라 지하차도 이름을 같이 내려준다) */
public class TransitHistoryItem {

    private final Long id;
    private final Long underpassId;
    private final String underpassName;
    private final String carNum;
    private final TransitStatus status;
    private final LocalDateTime entryAt;
    private final LocalDateTime exitAt;

    public TransitHistoryItem(Long id, Long underpassId, String underpassName, String carNum, TransitStatus status,
                              LocalDateTime entryAt, LocalDateTime exitAt) {
        this.id = id;
        this.underpassId = underpassId;
        this.underpassName = underpassName;
        this.carNum = carNum;
        this.status = status;
        this.entryAt = entryAt;
        this.exitAt = exitAt;
    }

    public Long getId() { return id; }
    public Long getUnderpassId() { return underpassId; }
    public String getUnderpassName() { return underpassName; }
    public String getCarNum() { return carNum; }
    public TransitStatus getStatus() { return status; }
    public LocalDateTime getEntryAt() { return entryAt; }
    public LocalDateTime getExitAt() { return exitAt; }
}
