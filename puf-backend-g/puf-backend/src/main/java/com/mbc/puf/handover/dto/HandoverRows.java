package com.mbc.puf.handover.dto;

import java.time.LocalDateTime;

import com.mbc.puf.common.enums.RiskLevel;
import com.mbc.puf.common.enums.UnderpassCurrentStatus;

/** 인수인계 집계용 쿼리 결과 행 (NativeSql 이 컬럼 별칭으로 채운다) */
public final class HandoverRows {

    private HandoverRows() {
    }

    /** 지하차도 이벤트 (차단·해제·위험 단계 변화) */
    public static class EventRow {
        private LocalDateTime createdAt;
        private String type;               // BLOCK / RELEASE / RISK_LEVEL_UP / RISK_LEVEL_DOWN
        private RiskLevel riskLevel;
        private String underpassName;
        private Boolean automatic;
        private String reason;

        public LocalDateTime getCreatedAt() { return createdAt; }
        public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
        public String getType() { return type; }
        public void setType(String type) { this.type = type; }
        public RiskLevel getRiskLevel() { return riskLevel; }
        public void setRiskLevel(RiskLevel riskLevel) { this.riskLevel = riskLevel; }
        public String getUnderpassName() { return underpassName; }
        public void setUnderpassName(String underpassName) { this.underpassName = underpassName; }
        public Boolean getAutomatic() { return automatic; }
        public void setAutomatic(Boolean automatic) { this.automatic = automatic; }
        public String getReason() { return reason; }
        public void setReason(String reason) { this.reason = reason; }
    }

    /** 지하차도 지금 상태 */
    public static class UnderpassRow {
        private Long underpassId;
        private String name;
        private RiskLevel riskLevel;
        private UnderpassCurrentStatus status;

        public Long getUnderpassId() { return underpassId; }
        public void setUnderpassId(Long underpassId) { this.underpassId = underpassId; }
        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        public RiskLevel getRiskLevel() { return riskLevel; }
        public void setRiskLevel(RiskLevel riskLevel) { this.riskLevel = riskLevel; }
        public UnderpassCurrentStatus getStatus() { return status; }
        public void setStatus(UnderpassCurrentStatus status) { this.status = status; }
    }
}
