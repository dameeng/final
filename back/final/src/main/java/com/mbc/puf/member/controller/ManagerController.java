package com.mbc.puf.member.controller;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
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
import com.mbc.puf.member.dto.EmployeeCheckResult;
import com.mbc.puf.member.dto.ManagerEmailCodeVerifyRequest;
import com.mbc.puf.member.dto.ManagerEmployeeCheckRequest;
import com.mbc.puf.member.dto.ManagerEmployeeCheckResponse;
import com.mbc.puf.member.dto.ManagerLoginRequest;
import com.mbc.puf.member.dto.ManagerLoginResponse;
import com.mbc.puf.member.dto.ManagerProfileResponse;
import com.mbc.puf.member.dto.ManagerSignupRequest;
import com.mbc.puf.member.dto.ManagerSignupResponse;
import com.mbc.puf.member.service.ManagerService;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/managers")
public class ManagerController {

    private static final String SIGNUP_EMPLOYEE_ID = "SIGNUP_EMPLOYEE_ID";

    private final ManagerService managerService;
    private final SessionLoginManager sessionLoginManager;

    public ManagerController(ManagerService managerService, SessionLoginManager sessionLoginManager) {
        this.managerService = managerService;
        this.sessionLoginManager = sessionLoginManager;
    }

    // 로그인: 확인이 끝나면 역할(role)과 담당 지역(regionId)을 세션에 남긴다
    @PostMapping("/login")
    public ApiResponse<ManagerLoginResponse> login(@Valid @RequestBody ManagerLoginRequest request,
                                                   HttpServletRequest httpRequest,
                                                   HttpServletResponse httpResponse) {
        ManagerLoginResponse result = managerService.login(request);
        sessionLoginManager.login(httpRequest, httpResponse, result.getId(), "MANAGER",
                result.getRole().name(), result.getRegionId());
        return ApiResponse.ok("로그인되었습니다.", result);
    }

    // 내 정보 조회 (관리자 로그인 필요)
    @GetMapping("/me")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'REGIONAL_ADMIN')")
    public ApiResponse<ManagerProfileResponse> me(@AuthenticationPrincipal LoginUser loginUser) {
        return ApiResponse.ok(managerService.getMyProfile(loginUser.id()));
    }

    // 비밀번호 변경 (마이페이지, 현재 비밀번호 확인 후 변경)
    @PutMapping("/me/password")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'REGIONAL_ADMIN')")
    public ApiResponse<Void> changePassword(@AuthenticationPrincipal LoginUser loginUser,
                                            @Valid @RequestBody PasswordChangeRequest request) {
        managerService.changePassword(loginUser.id(), request);
        return ApiResponse.ok("비밀번호가 변경되었습니다.", null);
    }

    // ==================== 회원가입 (로그인 없이 사용) ====================

    @GetMapping("/check-login-id")
    public ApiResponse<AvailabilityResponse> checkLoginId(@RequestParam("loginId") String loginId) {
        return ApiResponse.ok(managerService.checkLoginId(loginId));
    }

    @PostMapping("/signup/employee-check")
    public ApiResponse<ManagerEmployeeCheckResponse> checkEmployee(
            @Valid @RequestBody ManagerEmployeeCheckRequest request, HttpServletRequest httpRequest) {
        EmployeeCheckResult result = managerService.checkEmployeeAndSendCode(request);
        httpRequest.getSession(true).setAttribute(SIGNUP_EMPLOYEE_ID, result.getEmployeeId());
        return ApiResponse.ok("인증코드를 발송했습니다.", new ManagerEmployeeCheckResponse(result.getMaskedEmail()));
    }

    @PostMapping("/signup/email-code/resend")
    public ApiResponse<Void> resendEmailCode(HttpServletRequest httpRequest) {
        managerService.resendSignupCode(requireSignupEmployeeId(httpRequest));
        return ApiResponse.ok("인증코드를 다시 발송했습니다.", null);
    }

    @PostMapping("/signup/email-code/verify")
    public ApiResponse<Void> verifyEmailCode(@Valid @RequestBody ManagerEmailCodeVerifyRequest request,
                                             HttpServletRequest httpRequest) {
        managerService.verifySignupCode(requireSignupEmployeeId(httpRequest), request.getCode());
        return ApiResponse.ok("이메일 인증이 완료되었습니다.", null);
    }

    @PostMapping("/signup")
    public org.springframework.http.ResponseEntity<ApiResponse<ManagerSignupResponse>> signup(
            @Valid @RequestBody ManagerSignupRequest request, HttpServletRequest httpRequest) {
        ManagerSignupResponse response = managerService.signup(requireSignupEmployeeId(httpRequest), request);
        httpRequest.getSession().removeAttribute(SIGNUP_EMPLOYEE_ID);
        return org.springframework.http.ResponseEntity.status(org.springframework.http.HttpStatus.CREATED)
                .body(ApiResponse.ok("가입 신청이 완료되었습니다. 승인 후 로그인할 수 있습니다.", response));
    }

    private Long requireSignupEmployeeId(HttpServletRequest httpRequest) {
        HttpSession session = httpRequest.getSession(false);
        Object value = (session == null) ? null : session.getAttribute(SIGNUP_EMPLOYEE_ID);
        if (value instanceof Long employeeId) {
            return employeeId;
        }
        throw new com.mbc.puf.common.exception.BusinessException(org.springframework.http.HttpStatus.BAD_REQUEST,
                "가입 진행 정보가 없거나 만료되었습니다. 직원 확인부터 다시 진행해주세요.");
    }
}
