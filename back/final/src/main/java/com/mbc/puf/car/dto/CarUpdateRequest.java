package com.mbc.puf.car.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * 차량 수정 요청 (차량번호만 변경).
 * TODO(2차): 차량번호 자릿수·형식 검증(@Pattern)을 추가할 것. 지금은 빈 값만 막는다.
 */
public class CarUpdateRequest {

    @NotBlank(message = "차량번호는 필수입니다.")
    private String carNum;

    public CarUpdateRequest() {
    }

    public String getCarNum() { return carNum; }
    public void setCarNum(String carNum) { this.carNum = carNum; }
}
