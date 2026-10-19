package com.mbc.puf.alert.dto;

import java.time.LocalDateTime;

import com.mbc.puf.common.enums.AlertType;

/**
 * 고객용 "내 알림" 화면(휴대폰 문자처럼 보여주는 목업)용 DTO.
 * 관리자용 AlertLogListItem과 달리 표시에 바로 쓸 수 있게 지하차도 이름까지 조인해서 받고,
 * 문자 본문(messageText)도 서버에서 alertType별로 미리 조합해서 내려준다.
 */
public class MyAlertItem {

    private final Long id;
    private final String underpassName;
    private final String carNum;
    private final String recipientPhone;
    private final AlertType alertType;
    private final LocalDateTime sentAt;

    public MyAlertItem(Long id, String underpassName, String carNum, String recipientPhone,
                        AlertType alertType, LocalDateTime sentAt) {
        this.id = id;
        this.underpassName = underpassName;
        this.carNum = carNum;
        this.recipientPhone = recipientPhone;
        this.alertType = alertType;
        this.sentAt = sentAt;
    }

    public Long getId() { return id; }
    public String getUnderpassName() { return underpassName; }
    public String getCarNum() { return carNum; }
    public String getRecipientPhone() { return recipientPhone; }
    public AlertType getAlertType() { return alertType; }
    public LocalDateTime getSentAt() { return sentAt; }

    // 화면에 보여줄 알림 종류 한글 라벨 (접근 예측 vs 진입 직전)
    public String getAlertTypeLabel() {
        return alertType == AlertType.PREDICTIVE ? "접근 예측 경고" : "진입 직전 최종 경고";
    }

    // 문자메시지처럼 보이는 본문. PREDICTIVE/FINAL 구분해서 문구를 다르게 조합한다
    public String getMessageText() {
        if (alertType == AlertType.PREDICTIVE) {
            return String.format("[긴급재난문자] %s 접근 차량이 감지되었습니다. 차량번호 %s, 현재 위험 단계이니 우회를 권장합니다.",
                    underpassName, carNum);
        }
        return String.format("[긴급재난문자] %s 진입 직전입니다. 현재 통제 중인 구간이니 즉시 정차 후 우회하세요. (차량번호 %s)",
                underpassName, carNum);
    }
}
