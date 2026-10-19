package com.mbc.puf.car.dto;

import java.time.LocalDateTime;

public class CarResponse {

    private final Long id;
    private final String carNum;
    private final LocalDateTime createdAt;

    public CarResponse(Long id, String carNum, LocalDateTime createdAt) {
        this.id = id;
        this.carNum = carNum;
        this.createdAt = createdAt;
    }

    public Long getId() { return id; }
    public String getCarNum() { return carNum; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
