package com.mbc.puf.member.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** 고객 마이페이지 정보 수정 요청. 아이디·이름·생년월일·이메일은 여기서 바꾸지 않는다 */
public class CustomerProfileUpdateRequest {

    @NotBlank(message = "전화번호는 필수입니다.")
    @Pattern(regexp = "^\\d{2,3}-?\\d{3,4}-?\\d{4}$", message = "전화번호 형식이 올바르지 않습니다. (예: 010-1234-5678)")
    private String phone;

    // 선택 항목: 생략(null)하거나 빈 문자열이면 통과
    @Pattern(regexp = "^(\\d{2,3}-?\\d{3,4}-?\\d{4})?$", message = "긴급 연락처 형식이 올바르지 않습니다. (예: 010-1234-5678)")
    private String emergency;

    @NotBlank(message = "우편번호는 필수입니다.")
    @Size(max = 10, message = "우편번호는 10자 이하여야 합니다.")
    private String zipcode;

    @NotBlank(message = "도로명주소는 필수입니다.")
    @Size(max = 255, message = "도로명주소는 255자 이하여야 합니다.")
    private String roadAddress;

    @Size(max = 255, message = "상세주소는 255자 이하여야 합니다.")
    private String detailAddress;

    public CustomerProfileUpdateRequest() {
    }

    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }

    public String getEmergency() { return emergency; }
    public void setEmergency(String emergency) { this.emergency = emergency; }

    public String getZipcode() { return zipcode; }
    public void setZipcode(String zipcode) { this.zipcode = zipcode; }

    public String getRoadAddress() { return roadAddress; }
    public void setRoadAddress(String roadAddress) { this.roadAddress = roadAddress; }

    public String getDetailAddress() { return detailAddress; }
    public void setDetailAddress(String detailAddress) { this.detailAddress = detailAddress; }
}
