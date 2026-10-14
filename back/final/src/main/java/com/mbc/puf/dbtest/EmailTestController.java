package com.mbc.puf.dbtest;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.mbc.puf.common.response.ApiResponse;
import com.mbc.puf.member.dto.EmailCodeSendRequest;
import com.mbc.puf.member.dto.EmailCodeVerifyRequest;
import com.mbc.puf.member.service.EmailVerificationService;

import jakarta.validation.Valid;

/**
 * [임시] 이메일 인증 서비스 동작 확인용. 확인이 끝나면 삭제.
 * 실제 API는 고객/관리자 가입 단계에서 각 가입 흐름 안에 만든다.
 */
@RestController
@RequestMapping("/test/email")
public class EmailTestController {

    private final EmailVerificationService emailVerificationService;

    public EmailTestController(EmailVerificationService emailVerificationService) {
        this.emailVerificationService = emailVerificationService;
    }

    @PostMapping("/send")
    public ApiResponse<Void> send(@Valid @RequestBody EmailCodeSendRequest request) {
        emailVerificationService.sendSignupCode(request.getEmail());
        return ApiResponse.ok("인증코드를 발송했습니다.", null);
    }

    @PostMapping("/verify")
    public ApiResponse<Void> verify(@Valid @RequestBody EmailCodeVerifyRequest request) {
        emailVerificationService.verifySignupCode(request.getEmail(), request.getCode());
        return ApiResponse.ok("이메일 인증이 완료되었습니다.", null);
    }

    @GetMapping("/check")
    public ApiResponse<Void> check(@RequestParam("email") String email) {
        emailVerificationService.assertSignupVerified(email);
        return ApiResponse.ok("인증 완료 상태입니다.", null);
    }
}
