package com.mbc.puf.member.dto;

import java.time.LocalDateTime;

import com.mbc.puf.common.enums.ManagerRole;
import com.mbc.puf.common.enums.ManagerStatus;

/** 관리자 목록/단건 조회 쿼리의 결과 1행 (내부용). 이름·이메일·전화번호는 employee, 지역명은 region 에서 가져온다. */
public class ManagerListRow {

    private Long id;
    private String loginId;
    private ManagerRole role;
    private ManagerStatus status;
    private Long regionId;
    private String regionName;
    private String name;
    private String email;
    private String phone;
    private LocalDateTime createdAt;
    private LocalDateTime approvedAt;

    public ManagerListRow() {
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getLoginId() { return loginId; }
    public void setLoginId(String loginId) { this.loginId = loginId; }

    public ManagerRole getRole() { return role; }
    public void setRole(ManagerRole role) { this.role = role; }

    public ManagerStatus getStatus() { return status; }
    public void setStatus(ManagerStatus status) { this.status = status; }

    public Long getRegionId() { return regionId; }
    public void setRegionId(Long regionId) { this.regionId = regionId; }

    public String getRegionName() { return regionName; }
    public void setRegionName(String regionName) { this.regionName = regionName; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getApprovedAt() { return approvedAt; }
    public void setApprovedAt(LocalDateTime approvedAt) { this.approvedAt = approvedAt; }
}
