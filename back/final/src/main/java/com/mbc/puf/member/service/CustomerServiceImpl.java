package com.mbc.puf.member.service;

import java.util.Locale;

import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mbc.puf.common.exception.BusinessException;
import com.mbc.puf.member.dao.CustomerDao;
import com.mbc.puf.member.dto.AvailabilityResponse;
import com.mbc.puf.member.dto.PasswordChangeRequest;
import com.mbc.puf.member.dto.Customer;
import com.mbc.puf.member.dto.CustomerLoginRequest;
import com.mbc.puf.member.dto.CustomerLoginResponse;
import com.mbc.puf.member.dto.CustomerProfileResponse;
import com.mbc.puf.member.dto.CustomerProfileUpdateRequest;
import com.mbc.puf.member.dto.CustomerSignupRequest;
import com.mbc.puf.member.dto.CustomerSignupResponse;

@Service
public class CustomerServiceImpl implements CustomerService {

    private final CustomerDao customerDao;
    private final EmailVerificationService emailVerificationService;
    private final PasswordEncoder passwordEncoder;

    public CustomerServiceImpl(CustomerDao customerDao,
                               EmailVerificationService emailVerificationService,
                               PasswordEncoder passwordEncoder) {
        this.customerDao = customerDao;
        this.emailVerificationService = emailVerificationService;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    @Transactional(readOnly = true)
    public AvailabilityResponse checkLoginId(String loginId) {
        String target = requireText(loginId, "아이디를 입력해주세요.");
        return new AvailabilityResponse(customerDao.countByLoginId(target) == 0);
    }

    @Override
    @Transactional(readOnly = true)
    public AvailabilityResponse checkEmail(String email) {
        String target = normalizeEmail(requireText(email, "이메일을 입력해주세요."));
        return new AvailabilityResponse(customerDao.countByEmail(target) == 0);
    }

    @Override
    @Transactional
    public void sendSignupEmailCode(String email) {
        String target = normalizeEmail(email);
        if (customerDao.countByEmail(target) > 0) {
            throw conflict("이미 가입된 이메일입니다.");
        }
        emailVerificationService.sendSignupCode(target);
    }

    @Override
    public void verifySignupEmailCode(String email, String code) {
        emailVerificationService.verifySignupCode(email, code);
    }

    @Override
    @Transactional
    public CustomerSignupResponse signup(CustomerSignupRequest request) {
        if (!request.getPassword().equals(request.getPasswordConfirm())) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "비밀번호와 비밀번호 확인이 일치하지 않습니다.");
        }

        String loginId = request.getLoginId().trim();
        String email = normalizeEmail(request.getEmail());

        emailVerificationService.assertSignupVerified(email);

        if (customerDao.countByLoginId(loginId) > 0) {
            throw conflict("이미 사용 중인 아이디입니다.");
        }
        if (customerDao.countByEmail(email) > 0) {
            throw conflict("이미 가입된 이메일입니다.");
        }

        Customer customer = new Customer();
        customer.setLoginId(loginId);
        customer.setPassword(passwordEncoder.encode(request.getPassword()));
        customer.setName(request.getName().trim());
        customer.setBirthDate(request.getBirthDate());
        customer.setEmail(email);
        customer.setPhone(normalizePhone(request.getPhone()));
        customer.setEmergency(normalizePhone(request.getEmergency()));
        customer.setZipcode(request.getZipcode().trim());
        customer.setRoadAddress(request.getRoadAddress().trim());
        customer.setDetailAddress(blankToNull(request.getDetailAddress()));

        try {
            customerDao.insertCustomer(customer);
        } catch (DuplicateKeyException e) {
            throw conflict("이미 사용 중인 아이디 또는 이메일입니다.");
        }

        return new CustomerSignupResponse(customer.getId(), customer.getLoginId(), customer.getName());
    }

    @Override
    @Transactional(readOnly = true)
    public CustomerLoginResponse login(CustomerLoginRequest request) {
        Customer customer = customerDao.selectCustomerByLoginId(request.getLoginId().trim());

        if (customer == null || !passwordEncoder.matches(request.getPassword(), customer.getPassword())) {
            throw new BusinessException(HttpStatus.UNAUTHORIZED, "아이디 또는 비밀번호가 올바르지 않습니다.");
        }
        if (customer.isWithdrawn()) {
            throw new BusinessException(HttpStatus.FORBIDDEN, "탈퇴한 회원입니다.");
        }

        return new CustomerLoginResponse(customer.getId(), customer.getLoginId(), customer.getName());
    }

    // ==================== 마이페이지 ====================

    @Override
    @Transactional(readOnly = true)
    public CustomerProfileResponse getMyProfile(Long customerId) {
        Customer customer = requireActiveCustomer(customerId);
        return toProfileResponse(customer);
    }

    @Override
    @Transactional
    public CustomerProfileResponse updateProfile(Long customerId, CustomerProfileUpdateRequest request) {
        requireActiveCustomer(customerId);

        customerDao.updateCustomerProfile(customerId,
                normalizePhone(request.getPhone()),
                normalizePhone(request.getEmergency()),
                request.getZipcode().trim(),
                request.getRoadAddress().trim(),
                blankToNull(request.getDetailAddress()));

        return toProfileResponse(requireActiveCustomer(customerId));
    }

    @Override
    @Transactional
    public void changePassword(Long customerId, PasswordChangeRequest request) {
        if (!request.getNewPassword().equals(request.getNewPasswordConfirm())) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "새 비밀번호와 새 비밀번호 확인이 일치하지 않습니다.");
        }

        Customer customer = customerDao.selectCustomerPasswordById(customerId);
        if (customer == null || customer.isWithdrawn()) {
            throw new BusinessException(HttpStatus.UNAUTHORIZED, "유효하지 않은 계정입니다. 다시 로그인해주세요.");
        }
        if (!passwordEncoder.matches(request.getCurrentPassword(), customer.getPassword())) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "현재 비밀번호가 올바르지 않습니다.");
        }

        customerDao.updatePassword(customerId, passwordEncoder.encode(request.getNewPassword()));
    }

    @Override
    @Transactional
    public void withdraw(Long customerId) {
        requireActiveCustomer(customerId);
        customerDao.updateWithdraw(customerId);
    }

    // ---- 내부 메서드 ----

    private Customer requireActiveCustomer(Long customerId) {
        Customer customer = customerDao.selectCustomerById(customerId);
        if (customer == null || customer.isWithdrawn()) {
            throw new BusinessException(HttpStatus.UNAUTHORIZED, "유효하지 않은 계정입니다. 다시 로그인해주세요.");
        }
        return customer;
    }

    private CustomerProfileResponse toProfileResponse(Customer customer) {
        return new CustomerProfileResponse(customer.getId(), customer.getLoginId(), customer.getName(),
                customer.getBirthDate(), customer.getEmail(), customer.getPhone(), customer.getEmergency(),
                customer.getZipcode(), customer.getRoadAddress(), customer.getDetailAddress(),
                customer.getCreatedAt());
    }

    private String normalizeEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }

    // 하이픈을 제거해 숫자만 저장한다. 값이 없으면 null. 형식 검증은 요청 DTO에서 끝났다.
    private String normalizePhone(String phone) {
        String value = blankToNull(phone);
        return value == null ? null : value.replace("-", "");
    }

    private String requireText(String value, String message) {
        if (value == null || value.isBlank()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, message);
        }
        return value.trim();
    }

    private String blankToNull(String value) {
        return (value == null || value.isBlank()) ? null : value.trim();
    }

    private BusinessException conflict(String message) {
        return new BusinessException(HttpStatus.CONFLICT, message);
    }
}
