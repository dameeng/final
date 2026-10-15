package com.mbc.puf.member.dto;

import com.mbc.puf.common.enums.ManagerRole;

/** 관리자 로그인 결과. 로그인 상태는 세션 쿠키(JSESSIONID)로 유지된다. */
public class ManagerLoginResponse {

    private final Long id;
    private final String loginId;
    private final String name;
    private final ManagerRole role;      // SUPER_ADMIN / REGIONAL_ADMIN
    private final Long regionId;         // 지역담당자만 값이 있음 (최고관리자는 null)

    public ManagerLoginResponse(Long id, String loginId, String name, ManagerRole role, Long regionId) {
        this.id = id;
        this.loginId = loginId;
        this.name = name;
        this.role = role;
        this.regionId = regionId;
    }

    public Long getId() { return id; }
    public String getLoginId() { return loginId; }
    public String getName() { return name; }
    public ManagerRole getRole() { return role; }
    public Long getRegionId() { return regionId; }
}
