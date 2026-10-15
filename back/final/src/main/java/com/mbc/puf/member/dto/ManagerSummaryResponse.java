package com.mbc.puf.member.dto;

import java.time.LocalDateTime;

import com.mbc.puf.common.enums.ManagerRole;
import com.mbc.puf.common.enums.ManagerStatus;

/**
 * 관리자 목록의 한 항목이자, 승인·거절·탈퇴·지역 변경 후 돌려주는 계정 요약.
 * status 가 WITHDRAWN 이면 "탈퇴" 또는 "가입 거절" 둘 중 하나다 (DB에서는 구분하지 않는다).
 */
public class ManagerSummaryResponse {

    private final Long id;
    private final String loginId;
    private final String name;
    private final String email;
    private final String phone;
    private final ManagerRole role;
    private final ManagerStatus status;
    private final Long regionId;
    private final String regionName;
    private final LocalDateTime createdAt;
    private final LocalDateTime approvedAt;

    public ManagerSummaryResponse(Long id, String loginId, String name, String email, String phone,
                                  ManagerRole role, ManagerStatus status, Long regionId, String regionName,
                                  LocalDateTime createdAt, LocalDateTime approvedAt) {
        this.id = id;
        this.loginId = loginId;
        this.name = name;
        this.email = email;
        this.phone = phone;
        this.role = role;
        this.status = status;
        this.regionId = regionId;
        this.regionName = regionName;
        this.createdAt = createdAt;
        this.approvedAt = approvedAt;
    }

    public Long getId() { return id; }
    public String getLoginId() { return loginId; }
    public String getName() { return name; }
    public String getEmail() { return email; }
    public String getPhone() { return phone; }
    public ManagerRole getRole() { return role; }
    public ManagerStatus getStatus() { return status; }
    public Long getRegionId() { return regionId; }
    public String getRegionName() { return regionName; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getApprovedAt() { return approvedAt; }
}
