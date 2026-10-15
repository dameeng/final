package com.mbc.puf.member.service;

import com.mbc.puf.member.dto.AvailabilityResponse;
import com.mbc.puf.member.dto.PasswordChangeRequest;
import com.mbc.puf.member.dto.EmployeeCheckResult;
import com.mbc.puf.member.dto.ManagerEmployeeCheckRequest;
import com.mbc.puf.member.dto.ManagerLoginRequest;
import com.mbc.puf.member.dto.ManagerLoginResponse;
import com.mbc.puf.member.dto.ManagerProfileResponse;
import com.mbc.puf.member.dto.ManagerSignupRequest;
import com.mbc.puf.member.dto.ManagerSignupResponse;

public interface ManagerService {

    ManagerLoginResponse login(ManagerLoginRequest request);
    ManagerProfileResponse getMyProfile(Long managerId);
    AvailabilityResponse checkLoginId(String loginId);
    EmployeeCheckResult checkEmployeeAndSendCode(ManagerEmployeeCheckRequest request);
    void resendSignupCode(Long employeeId);
    void verifySignupCode(Long employeeId, String code);
    ManagerSignupResponse signup(Long employeeId, ManagerSignupRequest request);

    // 마이페이지
    void changePassword(Long managerId, PasswordChangeRequest request);
}
