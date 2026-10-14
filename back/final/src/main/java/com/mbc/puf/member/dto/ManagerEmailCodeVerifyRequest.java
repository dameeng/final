package com.mbc.puf.member.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

/** 관리자 가입 2단계: 인증코드 확인 요청 (이메일은 서버가 세션의 직원 정보에서 찾으므로 받지 않는다) */
public class ManagerEmailCodeVerifyRequest {

    @NotBlank(message = "인증코드는 필수입니다.")
    @Pattern(regexp = "^\\d{6}$", message = "인증코드는 6자리 숫자입니다.")
    private String code;

    public ManagerEmailCodeVerifyRequest() {
    }

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }
}
