package com.mbc.puf.member.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.mbc.puf.common.response.ApiResponse;
import com.mbc.puf.common.security.LoginUser;
import com.mbc.puf.common.security.SessionLoginManager;
import com.mbc.puf.member.dto.AvailabilityResponse;
import com.mbc.puf.member.dto.PasswordChangeRequest;
import com.mbc.puf.member.dto.CustomerProfileResponse;
import com.mbc.puf.member.dto.CustomerProfileUpdateRequest;
import com.mbc.puf.member.dto.CustomerSignupRequest;
import com.mbc.puf.member.dto.CustomerSignupResponse;
import com.mbc.puf.member.dto.CustomerLoginRequest;
import com.mbc.puf.member.dto.CustomerLoginResponse;
import com.mbc.puf.member.dto.EmailCodeSendRequest;
import com.mbc.puf.member.dto.EmailCodeVerifyRequest;
import com.mbc.puf.member.service.CustomerService;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/customers")
public class CustomerController {

    private final CustomerService customerService;
    private final SessionLoginManager sessionLoginManager;

    public CustomerController(CustomerService customerService, SessionLoginManager sessionLoginManager) {
        this.customerService = customerService;
        this.sessionLoginManager = sessionLoginManager;
    }

    @GetMapping("/check-login-id")
    public ApiResponse<AvailabilityResponse> checkLoginId(@RequestParam("loginId") String loginId) {
        return ApiResponse.ok(customerService.checkLoginId(loginId));
    }

    @GetMapping("/check-email")
    public ApiResponse<AvailabilityResponse> checkEmail(@RequestParam("email") String email) {
        return ApiResponse.ok(customerService.checkEmail(email));
    }

    @PostMapping("/email-code/send")
    public ApiResponse<Void> sendEmailCode(@Valid @RequestBody EmailCodeSendRequest request) {
        customerService.sendSignupEmailCode(request.getEmail());
        return ApiResponse.ok("인증코드를 발송했습니다.", null);
    }

    @PostMapping("/email-code/verify")
    public ApiResponse<Void> verifyEmailCode(@Valid @RequestBody EmailCodeVerifyRequest request) {
        customerService.verifySignupEmailCode(request.getEmail(), request.getCode());
        return ApiResponse.ok("이메일 인증이 완료되었습니다.", null);
    }

    @PostMapping("/signup")
    public ResponseEntity<ApiResponse<CustomerSignupResponse>> signup(
            @Valid @RequestBody CustomerSignupRequest request) {
        CustomerSignupResponse response = customerService.signup(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("회원가입이 완료되었습니다.", response));
    }

    // 로그인: 확인이 끝나면 세션에 로그인 상태를 남긴다 (응답 헤더의 Set-Cookie: JSESSIONID)
    @PostMapping("/login")
    public ApiResponse<CustomerLoginResponse> login(@Valid @RequestBody CustomerLoginRequest request,
                                                    HttpServletRequest httpRequest,
                                                    jakarta.servlet.http.HttpServletResponse httpResponse) {
        CustomerLoginResponse result = customerService.login(request);
        sessionLoginManager.login(httpRequest, httpResponse, result.getId(), "CUSTOMER", "CUSTOMER");
        return ApiResponse.ok("로그인되었습니다.", result);
    }

    // ==================== 마이페이지 (고객 로그인 필요) ====================

    // 내 정보 조회
    @GetMapping("/me")
    @PreAuthorize("hasRole('CUSTOMER')")
    public ApiResponse<CustomerProfileResponse> me(@AuthenticationPrincipal LoginUser loginUser) {
        return ApiResponse.ok(customerService.getMyProfile(loginUser.id()));
    }

    // 내 정보 수정 (전화번호·긴급연락처·주소만. 아이디·이름·생년월일·이메일은 여기서 바꾸지 않는다)
    @PutMapping("/me")
    @PreAuthorize("hasRole('CUSTOMER')")
    public ApiResponse<CustomerProfileResponse> updateMe(@AuthenticationPrincipal LoginUser loginUser,
                                                         @Valid @RequestBody CustomerProfileUpdateRequest request) {
        return ApiResponse.ok("정보가 수정되었습니다.", customerService.updateProfile(loginUser.id(), request));
    }

    // 비밀번호 변경 (현재 비밀번호 확인 후 변경)
    @PutMapping("/me/password")
    @PreAuthorize("hasRole('CUSTOMER')")
    public ApiResponse<Void> changePassword(@AuthenticationPrincipal LoginUser loginUser,
                                            @Valid @RequestBody PasswordChangeRequest request) {
        customerService.changePassword(loginUser.id(), request);
        return ApiResponse.ok("비밀번호가 변경되었습니다.", null);
    }

    // 회원 탈퇴 (본인). 탈퇴 즉시 세션도 종료한다
    @DeleteMapping("/me")
    @PreAuthorize("hasRole('CUSTOMER')")
    public ApiResponse<Void> withdraw(@AuthenticationPrincipal LoginUser loginUser, HttpServletRequest httpRequest) {
        customerService.withdraw(loginUser.id());
        sessionLoginManager.logout(httpRequest);
        return ApiResponse.ok("탈퇴가 완료되었습니다.", null);
    }
}
