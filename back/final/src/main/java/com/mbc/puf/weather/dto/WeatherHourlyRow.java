package com.mbc.puf.weather.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/** weather_hourly 조회 결과 한 행 (현재 날씨·시간별 예보 공용, 내부용) */
public class WeatherHourlyRow {

    private LocalDateTime targetAt;
    private String condition;
    private BigDecimal temperatureC;
    private Integer humidityPct;
    private BigDecimal rainfallMm;
    private Integer precipitationProb;

    public WeatherHourlyRow() {
    }

    public LocalDateTime getTargetAt() { return targetAt; }
    public void setTargetAt(LocalDateTime targetAt) { this.targetAt = targetAt; }

    public String getCondition() { return condition; }
    public void setCondition(String condition) { this.condition = condition; }

    public BigDecimal getTemperatureC() { return temperatureC; }
    public void setTemperatureC(BigDecimal temperatureC) { this.temperatureC = temperatureC; }

    public Integer getHumidityPct() { return humidityPct; }
    public void setHumidityPct(Integer humidityPct) { this.humidityPct = humidityPct; }

    public BigDecimal getRainfallMm() { return rainfallMm; }
    public void setRainfallMm(BigDecimal rainfallMm) { this.rainfallMm = rainfallMm; }

    public Integer getPrecipitationProb() { return precipitationProb; }
    public void setPrecipitationProb(Integer precipitationProb) { this.precipitationProb = precipitationProb; }
}
