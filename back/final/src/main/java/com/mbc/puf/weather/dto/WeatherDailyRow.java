package com.mbc.puf.weather.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

/** 날짜별로 묶은 예보 한 행 (일별 예보, 내부용) */
public class WeatherDailyRow {

    private LocalDate forecastDate;
    private BigDecimal minTemperature;
    private BigDecimal maxTemperature;
    private Integer precipitationProb;

    public WeatherDailyRow() {
    }

    public LocalDate getForecastDate() { return forecastDate; }
    public void setForecastDate(LocalDate forecastDate) { this.forecastDate = forecastDate; }

    public BigDecimal getMinTemperature() { return minTemperature; }
    public void setMinTemperature(BigDecimal minTemperature) { this.minTemperature = minTemperature; }

    public BigDecimal getMaxTemperature() { return maxTemperature; }
    public void setMaxTemperature(BigDecimal maxTemperature) { this.maxTemperature = maxTemperature; }

    public Integer getPrecipitationProb() { return precipitationProb; }
    public void setPrecipitationProb(Integer precipitationProb) { this.precipitationProb = precipitationProb; }
}
