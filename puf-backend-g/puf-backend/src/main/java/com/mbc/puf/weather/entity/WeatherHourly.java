package com.mbc.puf.weather.entity;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Objects;

import org.hibernate.annotations.Immutable;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;

/**
 * 시간별 날씨 (DB VIEW: weather_hourly, 읽기 전용).
 * 조회 시점 NOW() 기준으로 매번 계산되는 데모용 VIEW라 테이블이 아니다 → @Immutable 로 수정 불가 처리.
 * (새 DB 구조 단계에서 실제 기상청 데이터 테이블 weather / weather_forecast 로 바뀔 예정)
 * 행 번호(id)는 계산할 때마다 바뀔 수 있어서, (지역, 시각) 두 값을 묶어 식별자로 쓴다.
 */
@Entity
@Immutable
@Table(name = "weather_hourly")
@IdClass(WeatherHourly.Key.class)
public class WeatherHourly {

    @Id
    @Column(name = "area_id")
    private Long areaId;

    @Id
    @Column(name = "target_at")
    private LocalDateTime targetAt;

    @Column(name = "is_forecast")
    private boolean forecast;          // true = 예보, false = 관측

    @Column(name = "condition")
    private String condition;          // 맑음/구름많음/흐림/비

    @Column(name = "temp")
    private BigDecimal temperatureC;

    @Column(name = "humidity")
    private Integer humidityPct;

    @Column(name = "rain")
    private BigDecimal rainfallMm;

    @Column(name = "rain_prob")
    private Integer precipitationProb;

    protected WeatherHourly() {
    }

    public Long getAreaId() { return areaId; }
    public LocalDateTime getTargetAt() { return targetAt; }
    public boolean isForecast() { return forecast; }
    public String getCondition() { return condition; }
    public BigDecimal getTemperatureC() { return temperatureC; }
    public Integer getHumidityPct() { return humidityPct; }
    public BigDecimal getRainfallMm() { return rainfallMm; }
    public Integer getPrecipitationProb() { return precipitationProb; }

    /** 복합 식별자 (area_id + target_at) */
    public static class Key implements Serializable {
        private Long areaId;
        private LocalDateTime targetAt;

        public Key() {
        }

        @Override
        public boolean equals(Object o) {
            return o instanceof Key k && Objects.equals(areaId, k.areaId) && Objects.equals(targetAt, k.targetAt);
        }

        @Override
        public int hashCode() {
            return Objects.hash(areaId, targetAt);
        }
    }
}
