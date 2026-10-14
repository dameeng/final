package com.mbc.puf.common.mail;

/** 이메일 발송 추상화. 개발 중엔 ConsoleEmailSender, 나중에 SMTP 구현체로 교체한다. */
public interface EmailSender {

    void send(String to, String subject, String body);
}
