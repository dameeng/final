package com.mbc.puf.underpass.dto;

import java.time.LocalDateTime;

import com.mbc.puf.common.enums.TransitStatus;

/** underpass_transit 테이블 INSERT/UPDATE/SELECT용 (내부용) */
public class UnderpassTransit {

    private Long id;
    private Long underpassId;
    private String carNum;
    private Long entryPlateLogId;
    private Long exitPlateLogId;
    private TransitStatus status;
    private LocalDateTime entryAt;
    private LocalDateTime exitAt;

    public UnderpassTransit() {
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getUnderpassId() { return underpassId; }
    public void setUnderpassId(Long underpassId) { this.underpassId = underpassId; }

    public String getCarNum() { return carNum; }
    public void setCarNum(String carNum) { this.carNum = carNum; }

    public Long getEntryPlateLogId() { return entryPlateLogId; }
    public void setEntryPlateLogId(Long entryPlateLogId) { this.entryPlateLogId = entryPlateLogId; }

    public Long getExitPlateLogId() { return exitPlateLogId; }
    public void setExitPlateLogId(Long exitPlateLogId) { this.exitPlateLogId = exitPlateLogId; }

    public TransitStatus getStatus() { return status; }
    public void setStatus(TransitStatus status) { this.status = status; }

    public LocalDateTime getEntryAt() { return entryAt; }
    public void setEntryAt(LocalDateTime entryAt) { this.entryAt = entryAt; }

    public LocalDateTime getExitAt() { return exitAt; }
    public void setExitAt(LocalDateTime exitAt) { this.exitAt = exitAt; }
}
