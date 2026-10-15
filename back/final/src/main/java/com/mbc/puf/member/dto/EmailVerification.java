package com.mbc.puf.member.dto;

import java.time.LocalDateTime;

import com.mbc.puf.common.enums.VerificationPurpose;

/** email_verification 테이블 1행 (내부용, API 응답으로 내보내지 않는다) */
public class EmailVerification {

    private Long id;
    private Long customerId;            // PASSWORD_RESET + 고객
    private Long managerId;             // PASSWORD_RESET + 관리자
    private String email;               // SIGNUP
    private VerificationPurpose purpose;
    private String code;
    private LocalDateTime expiresAt;
    private LocalDateTime verifiedAt;
    private LocalDateTime createdAt;
    private boolean expired;            // 조회 시 DB 시계로 계산한 만료 여부 (테이블 컬럼 아님)

    public EmailVerification() {
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getCustomerId() { return customerId; }
    public void setCustomerId(Long customerId) { this.customerId = customerId; }

    public Long getManagerId() { return managerId; }
    public void setManagerId(Long managerId) { this.managerId = managerId; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public VerificationPurpose getPurpose() { return purpose; }
    public void setPurpose(VerificationPurpose purpose) { this.purpose = purpose; }

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }

    public LocalDateTime getExpiresAt() { return expiresAt; }
    public void setExpiresAt(LocalDateTime expiresAt) { this.expiresAt = expiresAt; }

    public LocalDateTime getVerifiedAt() { return verifiedAt; }
    public void setVerifiedAt(LocalDateTime verifiedAt) { this.verifiedAt = verifiedAt; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public boolean isExpired() { return expired; }
    public void setExpired(boolean expired) { this.expired = expired; }
}
