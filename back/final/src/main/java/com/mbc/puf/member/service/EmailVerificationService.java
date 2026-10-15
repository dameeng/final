package com.mbc.puf.member.service;

/** 가입용 이메일 인증 (고객·관리자 가입이 공통으로 사용) */
public interface EmailVerificationService {

    // 인증코드 생성 → 저장 → 메일 발송
    void sendSignupCode(String email);

    // 인증코드 확인. 실패하면 BusinessException
    void verifySignupCode(String email, String code);

    // 가입 제출 단계에서 호출: 최근에 인증 완료된 이메일이 아니면 BusinessException
    void assertSignupVerified(String email);
}
