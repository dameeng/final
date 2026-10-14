package com.mbc.puf.member.service;

public interface PasswordService {
    Long requestForCustomer(String loginId);
    void verifyForCustomer(Long customerId, String code);
    void confirmForCustomer(Long customerId, String newPassword, String newPasswordConfirm);

    Long requestForManager(String loginId);
    void verifyForManager(Long managerId, String code);
    void confirmForManager(Long managerId, String newPassword, String newPasswordConfirm);
}