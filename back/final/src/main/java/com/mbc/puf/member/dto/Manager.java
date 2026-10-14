package com.mbc.puf.member.dto;

import com.mbc.puf.common.enums.ManagerRole;
import com.mbc.puf.common.enums.ManagerStatus;

/** manager 테이블 1행 + 조회 시 함께 가져오는 employee/region 정보 (내부용, API로 그대로 내보내지 않는다) */
public class Manager {

    private Long id;
    private Long employeeId;
    private String loginId;
    private String password;          // BCrypt 해시 (로그인 확인용 조회에서만 채워진다)
    private ManagerRole role;
    private ManagerStatus status;
    private Long regionId;            // 지역담당자만 값이 있음

    // ---- 조인으로 가져오는 값 ----
    private String name;              // employee.name
    private String email;             // employee.email
    private String phone;             // employee.phone
    private String regionName;        // region.name

    public Manager() {
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getEmployeeId() { return employeeId; }
    public void setEmployeeId(Long employeeId) { this.employeeId = employeeId; }

    public String getLoginId() { return loginId; }
    public void setLoginId(String loginId) { this.loginId = loginId; }

    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }

    public ManagerRole getRole() { return role; }
    public void setRole(ManagerRole role) { this.role = role; }

    public ManagerStatus getStatus() { return status; }
    public void setStatus(ManagerStatus status) { this.status = status; }

    public Long getRegionId() { return regionId; }
    public void setRegionId(Long regionId) { this.regionId = regionId; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }

    public String getRegionName() { return regionName; }
    public void setRegionName(String regionName) { this.regionName = regionName; }
}
