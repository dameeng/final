package com.mbc.project;

import static com.mbc.project.TestEntities.withId;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import com.mbc.puf.board.repository.InquiryRepository;
import com.mbc.puf.car.repository.CarRepository;
import com.mbc.puf.common.enums.ManagerStatus;
import com.mbc.puf.common.enums.VerificationPurpose;
import com.mbc.puf.common.exception.BusinessException;
import com.mbc.puf.common.jpa.DbClock;
import com.mbc.puf.common.sms.SmsSender;
import com.mbc.puf.common.util.PhoneNumber;
import com.mbc.puf.member.dto.CustomerSignupRequest;
import com.mbc.puf.member.entity.Customer;
import com.mbc.puf.member.entity.Employee;
import com.mbc.puf.member.entity.Manager;
import com.mbc.puf.member.entity.PhoneVerify;
import com.mbc.puf.member.repository.CustomerRepository;
import com.mbc.puf.member.repository.DeviceTokenRepository;
import com.mbc.puf.member.repository.EmployeeRepository;
import com.mbc.puf.member.repository.ManagerRepository;
import com.mbc.puf.member.repository.PhoneVerifyRepository;
import com.mbc.puf.member.service.CustomerServiceImpl;
import com.mbc.puf.member.service.PasswordServiceImpl;
import com.mbc.puf.member.service.PhoneVerificationService;
import com.mbc.puf.member.service.PhoneVerificationService.ResetTarget;
import com.mbc.puf.member.service.PhoneVerificationServiceImpl;

/**
 * 회원·인증 묶음 단위 테스트 (v3: 전화번호 인증, 탈퇴 정리, 비밀번호 재설정).
 * 실제 API 흐름(가입→탈퇴→같은 번호로 재가입 등)은 Postman 컬렉션으로 따로 확인한다.
 */
class MemberServiceTest {

    private static final LocalDateTime NOW = LocalDateTime.of(2026, 10, 18, 20, 0);
    private static final PasswordEncoder ENCODER = new BCryptPasswordEncoder();

    // ===================== 전화번호 인증 =====================

    @Nested
    @ExtendWith(MockitoExtension.class)
    @DisplayName("전화번호 인증코드")
    class PhoneVerificationTests {

        private static final String PHONE = "01055556666";

        @Mock private PhoneVerifyRepository repository;
        @Mock private DbClock dbClock;
        @Mock private SmsSender smsSender;
        private PhoneVerificationServiceImpl service;

        @BeforeEach
        void setUp() {
            service = new PhoneVerificationServiceImpl(repository, dbClock, smsSender, 3, 60, 30);
            when(dbClock.now()).thenReturn(NOW);
        }

        private PhoneVerify latest(String code, LocalDateTime expiresAt) {
            PhoneVerify v = withId(new PhoneVerify(), 1L);
            v.setPhone(PHONE);
            v.setPurpose(VerificationPurpose.SIGNUP);
            v.setCode(code);
            v.setExpiresAt(expiresAt);
            return v;
        }

        @Test
        @DisplayName("발송하면 6자리 코드가 3분 유효로 저장되고 그 번호로 문자가 나간다")
        void send_savesCodeAndSendsSms() {
            service.sendSignupCode(PHONE);

            ArgumentCaptor<PhoneVerify> captor = ArgumentCaptor.forClass(PhoneVerify.class);
            verify(repository).save(captor.capture());
            assertTrue(captor.getValue().getCode().matches("\\d{6}"));
            assertEquals(NOW.plusMinutes(3), captor.getValue().getExpiresAt());
            verify(smsSender).send(eq(PHONE), anyString());
        }

        @Test
        @DisplayName("60초 안에 다시 요청하면 429이고 문자를 보내지 않는다")
        void send_withinCooldown_isTooManyRequests() {
            when(repository.countByPhoneAndPurposeAndCreatedAtAfter(PHONE, VerificationPurpose.SIGNUP,
                    NOW.minusSeconds(60))).thenReturn(1L);

            BusinessException e = assertThrows(BusinessException.class, () -> service.sendSignupCode(PHONE));

            assertEquals(HttpStatus.TOO_MANY_REQUESTS, e.getStatus());
            verify(smsSender, never()).send(anyString(), anyString());
        }

        @Test
        @DisplayName("코드가 맞으면 인증 완료 시각이 기록된다")
        void verify_correctCode_marksVerified() {
            PhoneVerify v = latest("123456", NOW.plusMinutes(1));
            when(repository.findFirstByPhoneAndPurposeOrderByIdDesc(PHONE, VerificationPurpose.SIGNUP))
                    .thenReturn(Optional.of(v));

            service.verifySignupCode(PHONE, "123456");

            assertEquals(NOW, v.getVerifiedAt());
        }

        @Test
        @DisplayName("코드가 틀리거나 만료됐으면 400")
        void verify_wrongOrExpired_isBadRequest() {
            when(repository.findFirstByPhoneAndPurposeOrderByIdDesc(PHONE, VerificationPurpose.SIGNUP))
                    .thenReturn(Optional.of(latest("123456", NOW.plusMinutes(1))))
                    .thenReturn(Optional.of(latest("123456", NOW)));   // expires_at == NOW → 만료

            assertEquals(HttpStatus.BAD_REQUEST,
                    assertThrows(BusinessException.class, () -> service.verifySignupCode(PHONE, "000000")).getStatus());
            assertEquals(HttpStatus.BAD_REQUEST,
                    assertThrows(BusinessException.class, () -> service.verifySignupCode(PHONE, "123456")).getStatus());
        }
    }

    // ===================== 고객 가입·탈퇴 =====================

    @Nested
    @ExtendWith(MockitoExtension.class)
    @DisplayName("고객 가입·탈퇴")
    class CustomerTests {

        @Mock private CustomerRepository customerRepository;
        @Mock private CarRepository carRepository;
        @Mock private InquiryRepository inquiryRepository;
        @Mock private DeviceTokenRepository deviceTokenRepository;
        @Mock private PhoneVerificationService phoneVerificationService;
        private CustomerServiceImpl service;

        @BeforeEach
        void setUp() {
            service = new CustomerServiceImpl(customerRepository, carRepository, inquiryRepository,
                    deviceTokenRepository, phoneVerificationService, ENCODER);
        }

        private CustomerSignupRequest signup(String email) {
            CustomerSignupRequest r = new CustomerSignupRequest();
            r.setLoginId("hong01");
            r.setPassword("pass1234!");
            r.setPasswordConfirm("pass1234!");
            r.setName("홍길동");
            r.setBirthDate(LocalDate.of(1995, 5, 5));
            r.setPhone("010-5555-6666");
            r.setEmail(email);
            return r;
        }

        private Customer active(Long id) {
            Customer c = withId(new Customer(), id);
            c.setPassword(ENCODER.encode("pass1234!"));
            return c;
        }

        @Test
        @DisplayName("이메일 없이 가입하면 이메일은 null, 전화번호는 숫자만 저장된다")
        void signup_withoutEmail() {
            service.signup(signup("  "));

            verify(phoneVerificationService).assertSignupVerified("01055556666");
            ArgumentCaptor<Customer> captor = ArgumentCaptor.forClass(Customer.class);
            verify(customerRepository).saveAndFlush(captor.capture());
            assertEquals("01055556666", captor.getValue().getPhone());
            assertEquals(null, captor.getValue().getEmail());
            verify(customerRepository, never()).existsByEmailAndWithdrawnFalse(any());
        }

        @Test
        @DisplayName("탈퇴하지 않은 계정이 같은 번호를 쓰고 있으면 409 (탈퇴 계정은 검사 대상 아님)")
        void signup_activePhoneDuplicate_isConflict() {
            when(customerRepository.existsByPhoneAndWithdrawnFalse("01055556666")).thenReturn(true);

            BusinessException e = assertThrows(BusinessException.class, () -> service.signup(signup(null)));

            assertEquals(HttpStatus.CONFLICT, e.getStatus());
            verify(customerRepository, never()).saveAndFlush(any());
        }

        @Test
        @DisplayName("탈퇴 시 비밀번호가 틀리면 400이고 아무것도 정리하지 않는다")
        void withdraw_wrongPassword_changesNothing() {
            Customer c = active(1L);
            when(customerRepository.findById(1L)).thenReturn(Optional.of(c));

            BusinessException e = assertThrows(BusinessException.class, () -> service.withdraw(1L, "wrong"));

            assertEquals(HttpStatus.BAD_REQUEST, e.getStatus());
            assertFalse(c.isWithdrawn());
            verify(carRepository, never()).softDeleteAllByCustomerId(any());
        }

        @Test
        @DisplayName("탈퇴하면 계정 + 차량·작성글 소프트 삭제 + 푸시 토큰 사용 중지를 함께 처리한다")
        void withdraw_cleansUpEverything() {
            Customer c = active(1L);
            when(customerRepository.findById(1L)).thenReturn(Optional.of(c));

            service.withdraw(1L, "pass1234!");

            assertTrue(c.isWithdrawn());
            verify(carRepository).softDeleteAllByCustomerId(1L);
            verify(inquiryRepository).softDeleteAllByCustomerId(1L);
            verify(deviceTokenRepository).deactivateAllByCustomerId(1L);
        }
    }

    // ===================== 비밀번호 재설정 =====================

    @Nested
    @ExtendWith(MockitoExtension.class)
    @DisplayName("비밀번호 재설정 (아이디 + 전화번호)")
    class PasswordResetTests {

        @Mock private CustomerRepository customerRepository;
        @Mock private ManagerRepository managerRepository;
        @Mock private EmployeeRepository employeeRepository;
        @Mock private PhoneVerificationService phoneVerificationService;
        @InjectMocks private PasswordServiceImpl service;

        @BeforeEach
        void setUp() {
            service = new PasswordServiceImpl(customerRepository, managerRepository, employeeRepository,
                    phoneVerificationService, ENCODER);
        }

        @Test
        @DisplayName("고객: 가입 번호와 다르면 404이고 문자를 보내지 않는다")
        void customer_phoneMismatch_isNotFound() {
            Customer c = withId(new Customer(), 1L);
            c.setPhone("01055556666");
            when(customerRepository.findByLoginIdAndWithdrawnFalse("hong01")).thenReturn(Optional.of(c));

            BusinessException e = assertThrows(BusinessException.class,
                    () -> service.requestForCustomer("hong01", "010-0000-0000"));

            assertEquals(HttpStatus.NOT_FOUND, e.getStatus());
            verify(phoneVerificationService, never()).sendResetCode(any(), anyString());
        }

        @Test
        @DisplayName("관리자: 직원 명단 번호와 맞으면 그 번호로 재설정 코드를 보낸다")
        void manager_phoneMatches_sendsCode() {
            Manager m = withId(new Manager(), 3L);
            m.setEmployeeId(7L);
            m.setStatus(ManagerStatus.ACTIVE);
            Employee e = withId(new Employee(), 7L);
            e.setPhone("010-3333-4444");
            when(managerRepository.findByLoginId("admin03")).thenReturn(Optional.of(m));
            when(employeeRepository.findById(7L)).thenReturn(Optional.of(e));

            Long id = service.requestForManager("admin03", "01033334444");

            assertEquals(3L, id);
            verify(phoneVerificationService).sendResetCode(ResetTarget.manager(3L), "01033334444");
        }
    }

    // ===================== 전화번호 정리 =====================

    @Test
    @DisplayName("전화번호는 하이픈·공백을 지우고, 마스킹은 앞 3자리와 끝 4자리만 남긴다")
    void phoneNumber_normalizeAndMask() {
        assertEquals("01012345678", PhoneNumber.normalize("010-1234 5678"));
        assertEquals("010-****-5678", PhoneNumber.mask("01012345678"));
        assertEquals("010-***-5678", PhoneNumber.mask("0101235678"));
        assertNotNull(PhoneNumber.mask(null));
    }
}
