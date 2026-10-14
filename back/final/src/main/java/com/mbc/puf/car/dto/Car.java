package com.mbc.puf.car.dto;

import java.time.LocalDateTime;

/** car 테이블 INSERT/SELECT용 (내부용) */
public class Car {

    private Long id;
    private Long customerId;
    private String carNum;
    private LocalDateTime createdAt;

    public Car() {
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getCustomerId() { return customerId; }
    public void setCustomerId(Long customerId) { this.customerId = customerId; }

    public String getCarNum() { return carNum; }
    public void setCarNum(String carNum) { this.carNum = carNum; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
