package com.mbc.puf.alert.dto;

import com.mbc.puf.common.enums.AlertType;

/** alert_log 테이블 INSERT용 (내부용). sent_at은 DB 기본값(NOW())을 그대로 쓴다 */
public class AlertLog {

    private Long id;
    private Long eventId;
    private Long customerId;
    private Long carId;
    private String carNum;
    private AlertType alertType;

    public AlertLog() {
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getEventId() { return eventId; }
    public void setEventId(Long eventId) { this.eventId = eventId; }

    public Long getCustomerId() { return customerId; }
    public void setCustomerId(Long customerId) { this.customerId = customerId; }

    public Long getCarId() { return carId; }
    public void setCarId(Long carId) { this.carId = carId; }

    public String getCarNum() { return carNum; }
    public void setCarNum(String carNum) { this.carNum = carNum; }

    public AlertType getAlertType() { return alertType; }
    public void setAlertType(AlertType alertType) { this.alertType = alertType; }
}
