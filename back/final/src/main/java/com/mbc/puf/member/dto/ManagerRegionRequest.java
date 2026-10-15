package com.mbc.puf.member.dto;

import jakarta.validation.constraints.NotNull;

/** 가입 승인, 담당 지역 변경에서 배정할 지역을 지정하는 요청 */
public class ManagerRegionRequest {

    @NotNull(message = "배정할 지역을 선택해주세요.")
    private Long regionId;

    public ManagerRegionRequest() {
    }

    public Long getRegionId() { return regionId; }
    public void setRegionId(Long regionId) { this.regionId = regionId; }
}
