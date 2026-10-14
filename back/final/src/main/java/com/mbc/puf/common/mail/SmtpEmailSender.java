package com.mbc.puf.common.mail;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Component;

/**
 * 실제 SMTP로 메일을 보낸다. 성공/실패와 무관하게 콘솔에도 항상 내용을 찍어서,
 * 실제 메일함이 없는 가짜 이메일로 테스트할 때도(발송 자체는 실패하지만 무시하고
 * 진행) 인증코드를 바로 확인할 수 있게 한다.
 *
 * ⚠️ ConsoleEmailSender.java와 이 클래스가 둘 다 @Component로 EmailSender를
 *    구현하고 있으면 Spring이 어떤 걸 주입해야 할지 몰라 실행 자체가 안 된다.
 *    이 파일을 넣을 땐 ConsoleEmailSender.java는 삭제할 것.
 */
@Component
public class SmtpEmailSender implements EmailSender {

    private static final Logger log = LoggerFactory.getLogger(SmtpEmailSender.class);

    private final JavaMailSender mailSender;
    private final String fromAddress;

    public SmtpEmailSender(JavaMailSender mailSender, @Value("${app.mail.from}") String fromAddress) {
        this.mailSender = mailSender;
        this.fromAddress = fromAddress;
    }

    @Override
    public void send(String to, String subject, String body) {
        // 콘솔에는 항상 찍는다 — 가짜 이메일로 테스트할 때 이 로그로 인증코드를 확인하면 된다
        log.info("\n===== [메일 발송] =====\n받는 사람: {}\n제목: {}\n내용: {}\n=======================",
                to, subject, body);

        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(fromAddress);
            message.setTo(to);
            message.setSubject(subject);
            message.setText(body);
            mailSender.send(message);
        } catch (MailException e) {
            // 가짜 이메일이거나 SMTP 설정이 아직 안 맞아도, 위 콘솔 로그로 이미 확인 가능하니
            // 여기서 예외를 던지지 않는다(가입·비밀번호재설정 흐름 자체가 막히면 안 되므로)
            log.warn("실제 메일 발송 실패(콘솔 로그로 대체함): to={}, reason={}", to, e.getMessage());
        }
    }
}
