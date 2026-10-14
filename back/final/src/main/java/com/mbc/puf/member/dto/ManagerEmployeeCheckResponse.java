package com.mbc.puf.member.dto;

/** 직원 대조 결과. 인증코드를 보낸 이메일을 일부 가려서 알려준다. */
public class ManagerEmployeeCheckResponse {

    private final String maskedEmail;   // 예: hon*@company.com

    public ManagerEmployeeCheckResponse(String maskedEmail) {
        this.maskedEmail = maskedEmail;
    }

    public String getMaskedEmail() {
        return maskedEmail;
    }
}
