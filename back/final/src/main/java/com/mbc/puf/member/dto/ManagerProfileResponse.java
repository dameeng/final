package com.mbc.puf.member.dto;

import com.mbc.puf.common.enums.ManagerRole;

/** 관리자 내 정보 조회 결과 (마이페이지 MP-03 조각에서 확장할 예정) */
public class ManagerProfileResponse {

    private final Long id;
    private final String loginId;
    private final String name;
    private final String email;
    private final String phone;
    private final ManagerRole role;
    private final Long regionId;
    private final String regionName;

    public ManagerProfileResponse(Long id, String loginId, String name, String email, String phone,
                                  ManagerRole role, Long regionId, String regionName) {
        this.id = id;
        this.loginId = loginId;
        this.name = name;
        this.email = email;
        this.phone = phone;
        this.role = role;
        this.regionId = regionId;
        this.regionName = regionName;
    }

    public Long getId() { return id; }
    public String getLoginId() { return loginId; }
    public String getName() { return name; }
    public String getEmail() { return email; }
    public String getPhone() { return phone; }
    public ManagerRole getRole() { return role; }
    public Long getRegionId() { return regionId; }
    public String getRegionName() { return regionName; }
}
