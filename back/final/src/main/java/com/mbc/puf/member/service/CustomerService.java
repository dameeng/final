package com.mbc.puf.member.service;

import com.mbc.puf.member.dto.AvailabilityResponse;
import com.mbc.puf.member.dto.PasswordChangeRequest;
import com.mbc.puf.member.dto.CustomerLoginRequest;
import com.mbc.puf.member.dto.CustomerLoginResponse;
import com.mbc.puf.member.dto.CustomerProfileResponse;
import com.mbc.puf.member.dto.CustomerProfileUpdateRequest;
import com.mbc.puf.member.dto.CustomerSignupRequest;
import com.mbc.puf.member.dto.CustomerSignupResponse;

public interface CustomerService {

    AvailabilityResponse checkLoginId(String loginId);
    AvailabilityResponse checkEmail(String email);
    void sendSignupEmailCode(String email);
    void verifySignupEmailCode(String email, String code);
    CustomerSignupResponse signup(CustomerSignupRequest request);
    CustomerLoginResponse login(CustomerLoginRequest request);

    // 마이페이지
    CustomerProfileResponse getMyProfile(Long customerId);
    CustomerProfileResponse updateProfile(Long customerId, CustomerProfileUpdateRequest request);
    void changePassword(Long customerId, PasswordChangeRequest request);
    void withdraw(Long customerId);
}
