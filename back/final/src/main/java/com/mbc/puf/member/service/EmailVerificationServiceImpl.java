package com.mbc.puf.member.service;

import java.security.SecureRandom;
import java.util.Locale;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mbc.puf.common.enums.VerificationPurpose;
import com.mbc.puf.common.exception.BusinessException;
import com.mbc.puf.common.mail.EmailSender;
import com.mbc.puf.member.dao.EmailVerificationDao;
import com.mbc.puf.member.dto.EmailVerification;

@Service
public class EmailVerificationServiceImpl implements EmailVerificationService {

    private static final VerificationPurpose SIGNUP = VerificationPurpose.SIGNUP;

    // 인증코드는 예측 불가능해야 하므로 Random 이 아니라 SecureRandom 사용
    private final SecureRandom secureRandom = new SecureRandom();

    private final EmailVerificationDao emailVerificationDao;
    private final EmailSender emailSender;

    private final int codeTtlMinutes;          // 코드 유효 시간
    private final int resendCooldownSeconds;   // 재발송 대기 시간
    private final int verifiedValidMinutes;    // 인증 완료 후 가입 제출까지 허용 시간

    public EmailVerificationServiceImpl(
            EmailVerificationDao emailVerificationDao,
            EmailSender emailSender,
            @Value("${app.email-verification.code-ttl-minutes:5}") int codeTtlMinutes,
            @Value("${app.email-verification.resend-cooldown-seconds:60}") int resendCooldownSeconds,
            @Value("${app.email-verification.verified-valid-minutes:30}") int verifiedValidMinutes) {
        this.emailVerificationDao = emailVerificationDao;
        this.emailSender = emailSender;
        this.codeTtlMinutes = codeTtlMinutes;
        this.resendCooldownSeconds = resendCooldownSeconds;
        this.verifiedValidMinutes = verifiedValidMinutes;
    }

    @Override
    @Transactional
    public void sendSignupCode(String email) {
        String target = normalize(email);

        if (emailVerificationDao.countRecentSent(target, SIGNUP, resendCooldownSeconds) > 0) {
            throw new BusinessException(HttpStatus.TOO_MANY_REQUESTS,
                    "인증코드는 " + resendCooldownSeconds + "초 후에 다시 요청할 수 있습니다.");
        }

        String code = generateCode();
        emailVerificationDao.insertVerification(target, SIGNUP, code, codeTtlMinutes);

        // 메일 발송이 실패하면 예외가 나서 위 저장도 함께 롤백된다
        emailSender.send(target, "[PUF] 이메일 인증코드",
                "인증코드: " + code + " (" + codeTtlMinutes + "분 이내에 입력해주세요)");
    }

    // TODO(2차): 코드 입력 실패 횟수 제한 (6자리 코드 무차별 대입 방지)
    //  - email_verification 에 attempt_count 컬럼을 두고 실패 시 +1 하는 방식이 유력
    //  - 실패 횟수를 저장한 뒤 예외를 던지게 되므로 @Transactional(noRollbackFor = BusinessException.class) 필수
    //    (기본 설정이면 예외 때문에 +1 도 롤백되어 제한이 동작하지 않는다)
    @Override
    @Transactional
    public void verifySignupCode(String email, String code) {
        String target = normalize(email);

        EmailVerification verification =
                emailVerificationDao.selectLatestVerificationByEmail(target, SIGNUP);

        if (verification == null) {
            throw badRequest("인증코드를 먼저 요청해주세요.");
        }
        if (verification.getVerifiedAt() != null) {
            return;   // 이미 인증 완료 (중복 클릭 등) → 성공으로 처리
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
    @Transactional(readOnly = true)
    public void assertSignupVerified(String email) {
        String target = normalize(email);

        if (emailVerificationDao.countRecentVerified(target, SIGNUP, verifiedValidMinutes) == 0) {
            throw badRequest("이메일 인증이 필요합니다. 인증 후 " + verifiedValidMinutes + "분 이내에 가입을 완료해주세요.");
        }
    }

    // ---- 내부 메서드 ----

    // 발송/확인/가입 어디서든 같은 이메일로 인식되도록 공백 제거 + 소문자 통일
    private String normalize(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }

    // 6자리 숫자 (앞자리가 0이어도 6자리 유지)
    private String generateCode() {
        return String.format("%06d", secureRandom.nextInt(1_000_000));
    }

    private BusinessException badRequest(String message) {
        return new BusinessException(HttpStatus.BAD_REQUEST, message);
    }
}
