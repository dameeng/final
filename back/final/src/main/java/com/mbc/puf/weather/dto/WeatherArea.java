package com.mbc.puf.weather.dto;

import java.math.BigDecimal;

/** weather_area 한 행 (날씨 지역) */
public class WeatherArea {

    private Long id;
    private String name;
    private BigDecimal latitude;
    private BigDecimal longitude;

    public WeatherArea() {
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public BigDecimal getLatitude() { return latitude; }
    public void setLatitude(BigDecimal latitude) { this.latitude = latitude; }

    public BigDecimal getLongitude() { return longitude; }
    public void setLongitude(BigDecimal longitude) { this.longitude = longitude; }
}
