package com.mbc.puf.member.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mbc.puf.common.enums.ManagerStatus;
import com.mbc.puf.common.exception.BusinessException;
import com.mbc.puf.common.mail.EmailSender;
import com.mbc.puf.common.util.VerificationCodeGenerator;
import com.mbc.puf.member.dao.CustomerDao;
import com.mbc.puf.member.dao.EmailVerificationDao;
import com.mbc.puf.member.dao.ManagerDao;
import com.mbc.puf.member.dto.Customer;
import com.mbc.puf.member.dto.EmailVerification;
import com.mbc.puf.member.dto.Manager;

@Service
public class PasswordServiceImpl implements PasswordService {

	private final CustomerDao customerDao;
	private final ManagerDao managerDao;
	private final EmailVerificationDao emailVerificationDao;
	private final EmailSender emailSender;
	private final PasswordEncoder passwordEncoder;

	private final int codeTtlMinutes;
	private final int resendCooldownSeconds;
	private final int verifiedValidMinutes;

	public PasswordServiceImpl(CustomerDao customerDao, ManagerDao managerDao,
			EmailVerificationDao emailVerificationDao, EmailSender emailSender, PasswordEncoder passwordEncoder,
			@Value("${app.password-reset.code-ttl-minutes:3}") int codeTtlMinutes,
			@Value("${app.password-reset.resend-cooldown-seconds:60}") int resendCooldownSeconds,
			@Value("${app.password-reset.verified-valid-minutes:30}") int verifiedValidMinutes) {
		this.customerDao = customerDao;
		this.managerDao = managerDao;
		this.emailVerificationDao = emailVerificationDao;
		this.emailSender = emailSender;
		this.passwordEncoder = passwordEncoder;
		this.codeTtlMinutes = codeTtlMinutes;
		this.resendCooldownSeconds = resendCooldownSeconds;
		this.verifiedValidMinutes = verifiedValidMinutes;
	}

	@Override
	@Transactional
	public Long requestForCustomer(String loginId) {
		// 로그인 아이디로 고객 정보 찾기
		Customer customer = customerDao.selectCustomerByLoginId(loginId.trim());
		// 없는 고객이거나 탈퇴고객이면
		if (customer == null || customer.isWithdrawn()) {
			// 존재하지 않는 아이디입니다 메시지 출력
			throw new BusinessException(HttpStatus.NOT_FOUND, "존재하지 않는 아이디입니다.");
		}

		// 이메일 인증 코드 재발송 대기 시간 안 지났으면 n초 후 다시 시도해라
		if (emailVerificationDao.countRecentSentPasswordResetByCustomerId(customer.getId(),
				resendCooldownSeconds) > 0) {
			throw new BusinessException(HttpStatus.TOO_MANY_REQUESTS,
					"인증코드는 " + resendCooldownSeconds + "초 후에 다시 요청할 수 있습니다.");
		}

		// 둘다 통과하면 새 코드 발급
		String code = VerificationCodeGenerator.generate();
		// 이메일 인증 테이블에 고객 비번 재설정 인증코드 넣기
		emailVerificationDao.insertPasswordResetForCustomer(customer.getId(), code, codeTtlMinutes);

		// 이메일 전송
		emailSender.send(customer.getEmail(), "[PUF] 비밀번호 재설정 인증코드",
				"인증코드: " + code + " (" + codeTtlMinutes + "분 이내에 입력해주세요)");

		// 세션에서 일단 고객 아이디 임시로 갖고 있기
		return customer.getId();
	}

	@Override
	@Transactional
	public Long requestForManager(String loginId) {
		// 로그인 아이디로 매니저 확인
		Manager manager = managerDao.selectManagerByLoginId(loginId.trim());

		// 없거나 active 계정이 아니면 존재 X 메시지
		if (manager == null || manager.getStatus() != ManagerStatus.ACTIVE) {
			throw new BusinessException(HttpStatus.NOT_FOUND, "존재하지 않는 아이디입니다.");
		}

		// 재발송 대기시간 안 지났으면 대기 요청
		if (emailVerificationDao.countRecentSentPasswordResetByManagerId(manager.getId(), resendCooldownSeconds) > 0) {
			throw new BusinessException(HttpStatus.TOO_MANY_REQUESTS,
					"인증코드는 " + resendCooldownSeconds + "초 후에 다시 요청할 수 있습니다.");
		}

		// 코드 만들기
		String code = VerificationCodeGenerator.generate();
		// db에 집어넣기
		emailVerificationDao.insertPasswordResetForManager(manager.getId(), code, codeTtlMinutes);

		// 이메일 보내기
		emailSender.send(manager.getEmail(), "[PUF] 비밀번호 재설정 인증코드",
				"인증코드: " + code + " (" + codeTtlMinutes + "분 이내에 입력해주세요)");

		// 매니저 아이디 저장
		return manager.getId();
	}

	@Override
	public void verifyForCustomer(Long customerId, String code) {
		EmailVerification verification = emailVerificationDao.selectLatestPasswordResetByCustomerId(customerId);

		if (verification == null) {
			throw badRequest("인증코드를 먼저 요청해주세요.");
		}
		if (verification.getVerifiedAt() != null) {
			return; // 이미 인증 완료 (중복 클릭 등) → 성공으로 처리
		}
		if (verification.isExpired()) {
			throw badRequest("인증코드가 만료되었습니다. 다시 요청해주세요.");
		}
		if (!verification.getCode().equals(code)) {
			throw badRequest("인증코드가 일치하지 않습니다.");
		}

		emailVerificationDao.updateVerifiedAt(verification.getId());
	}

	@Override
	public void verifyForManager(Long managerId, String code) {
		EmailVerification verification = emailVerificationDao.selectLatestPasswordResetByManagerId(managerId);

		if (verification == null) {
			throw badRequest("인증코드를 먼저 요청해주세요.");
		}
		if (verification.getVerifiedAt() != null) {
			return; // 이미 인증 완료 (중복 클릭 등) → 성공으로 처리
		}
		if (verification.isExpired()) {
			throw badRequest("인증코드가 만료되었습니다. 다시 요청해주세요.");
		}
		if (!verification.getCode().equals(code)) {
			throw badRequest("인증코드가 일치하지 않습니다.");
		}

		emailVerificationDao.updateVerifiedAt(verification.getId());
	}

	@Override
	public void confirmForCustomer(Long customerId, String newPassword, String newPasswordConfirm) {
		// 이메일 인증 안 됐으면
		if (emailVerificationDao.countRecentVerifiedPasswordResetByCustomerId(customerId, verifiedValidMinutes) == 0) {
			throw badRequest("이메일 인증이 필요합니다. 인증 후 " + verifiedValidMinutes + "분 이내에 비밀번호를 변경해주세요.");
		}

		// 새 비번 확인
		if (!newPassword.equals(newPasswordConfirm)) {
			throw badRequest("비밀번호와 비밀번호 확인이 일치하지 않습니다.");
		}

		// 암호화해서 저장
		customerDao.updatePassword(customerId, passwordEncoder.encode(newPassword));
	}

	@Override
	public void confirmForManager(Long managerId, String newPassword, String newPasswordConfirm) {
		// 이메일 인증 안 됐으면
		if (emailVerificationDao.countRecentVerifiedPasswordResetByManagerId(managerId, verifiedValidMinutes) == 0) {
			throw badRequest("이메일 인증이 필요합니다. 인증 후 " + verifiedValidMinutes + "분 이내에 비밀번호를 변경해주세요.");
		}

		// 새 비번 확인
		if (!newPassword.equals(newPasswordConfirm)) {
			throw badRequest("비밀번호와 비밀번호 확인이 일치하지 않습니다.");
		}

		// 암호화해서 저장
		managerDao.updatePassword(managerId, passwordEncoder.encode(newPassword));
	}

	// ---- 내부 매서드 ----
	private BusinessException badRequest(String message) {
		return new BusinessException(HttpStatus.BAD_REQUEST, message);
	}

}
