package com.mbc.puf.member.service;

import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mbc.puf.common.enums.ManagerRole;
import com.mbc.puf.common.enums.ManagerStatus;
import com.mbc.puf.common.exception.BusinessException;
import com.mbc.puf.common.util.EmailMasker;
import com.mbc.puf.member.dao.EmployeeDao;
import com.mbc.puf.member.dao.ManagerDao;
import com.mbc.puf.member.dto.AvailabilityResponse;
import com.mbc.puf.member.dto.PasswordChangeRequest;
import com.mbc.puf.member.dto.Employee;
import com.mbc.puf.member.dto.EmployeeCheckResult;
import com.mbc.puf.member.dto.Manager;
import com.mbc.puf.member.dto.ManagerEmployeeCheckRequest;
import com.mbc.puf.member.dto.ManagerLoginRequest;
import com.mbc.puf.member.dto.ManagerLoginResponse;
import com.mbc.puf.member.dto.ManagerProfileResponse;
import com.mbc.puf.member.dto.ManagerSignupRequest;
import com.mbc.puf.member.dto.ManagerSignupResponse;

@Service
public class ManagerServiceImpl implements ManagerService {

    private final ManagerDao managerDao;
    private final EmployeeDao employeeDao;
    private final EmailVerificationService emailVerificationService;
    private final PasswordEncoder passwordEncoder;

    public ManagerServiceImpl(ManagerDao managerDao,
                              EmployeeDao employeeDao,
                              EmailVerificationService emailVerificationService,
                              PasswordEncoder passwordEncoder) {
        this.managerDao = managerDao;
        this.employeeDao = employeeDao;
        this.emailVerificationService = emailVerificationService;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    @Transactional(readOnly = true)
    public ManagerLoginResponse login(ManagerLoginRequest request) {
        Manager manager = managerDao.selectManagerByLoginId(request.getLoginId().trim());

        if (manager == null || !passwordEncoder.matches(request.getPassword(), manager.getPassword())) {
            throw new BusinessException(HttpStatus.UNAUTHORIZED, "아이디 또는 비밀번호가 올바르지 않습니다.");
        }
        if (manager.getStatus() == ManagerStatus.PENDING) {
            throw new BusinessException(HttpStatus.FORBIDDEN, "승인 대기 중입니다. 승인이 완료된 후 다시 로그인해주세요.");
        }
        if (manager.getStatus() != ManagerStatus.ACTIVE) {
            throw new BusinessException(HttpStatus.FORBIDDEN, "사용할 수 없는 계정입니다.");
        }

        return new ManagerLoginResponse(manager.getId(), manager.getLoginId(), manager.getName(),
                manager.getRole(), manager.getRegionId());
    }

    @Override
    @Transactional(readOnly = true)
    public ManagerProfileResponse getMyProfile(Long managerId) {
        Manager manager = managerDao.selectManagerProfileById(managerId);
        if (manager == null || manager.getStatus() != ManagerStatus.ACTIVE) {
            throw new BusinessException(HttpStatus.UNAUTHORIZED, "유효하지 않은 계정입니다. 다시 로그인해주세요.");
        }
        return new ManagerProfileResponse(manager.getId(), manager.getLoginId(), manager.getName(),
                manager.getEmail(), manager.getPhone(), manager.getRole(),
                manager.getRegionId(), manager.getRegionName());
    }

    @Override
    @Transactional(readOnly = true)
    public AvailabilityResponse checkLoginId(String loginId) {
        if (loginId == null || loginId.isBlank()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "아이디를 입력해주세요.");
        }
        return new AvailabilityResponse(managerDao.countByLoginId(loginId.trim()) == 0);
    }

    @Override
    @Transactional
    public EmployeeCheckResult checkEmployeeAndSendCode(ManagerEmployeeCheckRequest request) {
        Employee employee = employeeDao.selectEmployeeByIdentity(
                request.getName().trim(), request.getBirthDate(), digitsOnly(request.getPhone()));

        if (employee == null) {
            throw new BusinessException(HttpStatus.NOT_FOUND,
                    "일치하는 직원 정보가 없습니다. 이름, 생년월일, 전화번호를 확인해주세요.");
        }
        assertNoActiveAccount(employee.getId());

        emailVerificationService.sendSignupCode(employee.getEmail());
        return new EmployeeCheckResult(employee.getId(), EmailMasker.mask(employee.getEmail()));
    }

    @Override
    @Transactional
    public void resendSignupCode(Long employeeId) {
        Employee employee = requireEmployee(employeeId);
        assertNoActiveAccount(employeeId);
        emailVerificationService.sendSignupCode(employee.getEmail());
    }

    @Override
    public void verifySignupCode(Long employeeId, String code) {
        Employee employee = requireEmployee(employeeId);
        emailVerificationService.verifySignupCode(employee.getEmail(), code);
    }

    @Override
    @Transactional
    public ManagerSignupResponse signup(Long employeeId, ManagerSignupRequest request) {
        if (!request.getPassword().equals(request.getPasswordConfirm())) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "비밀번호와 비밀번호 확인이 일치하지 않습니다.");
        }

        Employee employee = requireEmployee(employeeId);

        emailVerificationService.assertSignupVerified(employee.getEmail());
        assertNoActiveAccount(employeeId);

        String loginId = request.getLoginId().trim();
        if (managerDao.countByLoginId(loginId) > 0) {
            throw new BusinessException(HttpStatus.CONFLICT, "이미 사용 중인 아이디입니다.");
        }

        Manager manager = new Manager();
        manager.setEmployeeId(employeeId);
        manager.setLoginId(loginId);
        manager.setPassword(passwordEncoder.encode(request.getPassword()));
        manager.setRole(ManagerRole.REGIONAL_ADMIN);
        manager.setStatus(ManagerStatus.PENDING);

        try {
            managerDao.insertManager(manager);
        } catch (DuplicateKeyException e) {
            throw new BusinessException(HttpStatus.CONFLICT, "이미 사용 중인 아이디이거나 이미 가입된 직원입니다.");
        }
        return new ManagerSignupResponse(manager.getId(), manager.getLoginId(), manager.getStatus());
    }

    // ==================== 마이페이지 ====================

    @Override
    @Transactional
    public void changePassword(Long managerId, PasswordChangeRequest request) {
        if (!request.getNewPassword().equals(request.getNewPasswordConfirm())) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "새 비밀번호와 새 비밀번호 확인이 일치하지 않습니다.");
        }

        Manager manager = managerDao.selectManagerPasswordById(managerId);
        if (manager == null || manager.getStatus() != ManagerStatus.ACTIVE) {
            throw new BusinessException(HttpStatus.UNAUTHORIZED, "유효하지 않은 계정입니다. 다시 로그인해주세요.");
        }
        if (!passwordEncoder.matches(request.getCurrentPassword(), manager.getPassword())) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "현재 비밀번호가 올바르지 않습니다.");
        }

        managerDao.updatePassword(managerId, passwordEncoder.encode(request.getNewPassword()));
    }

    // ---- 내부 메서드 ----

    private Employee requireEmployee(Long employeeId) {
        Employee employee = employeeDao.selectEmployeeById(employeeId);
        if (employee == null) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "직원 정보를 찾을 수 없습니다. 처음부터 다시 진행해주세요.");
        }
        return employee;
    }

    private void assertNoActiveAccount(Long employeeId) {
        if (managerDao.countActiveByEmployeeId(employeeId) > 0) {
            throw new BusinessException(HttpStatus.CONFLICT, "이미 가입되었거나 승인 대기 중인 직원입니다.");
        }
    }

    private String digitsOnly(String phone) {
        return phone.trim().replace("-", "");
    }
}
