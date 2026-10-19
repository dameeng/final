package com.mbc.puf.weather.repository;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.mbc.puf.weather.entity.WeatherHourly;

public interface WeatherHourlyRepository extends JpaRepository<WeatherHourly, WeatherHourly.Key> {

    // 현재 날씨: now 까지의 관측값 중 가장 최근 1건
    List<WeatherHourly> findByAreaIdAndForecastFalseAndTargetAtLessThanEqualOrderByTargetAtDesc(
            Long areaId, LocalDateTime now, Limit limit);

    // 시간별 예보: now 이후 예보 N건 (시간 오름차순)
    List<WeatherHourly> findByAreaIdAndForecastTrueAndTargetAtGreaterThanOrderByTargetAtAsc(
            Long areaId, LocalDateTime now, Limit limit);

    // 일별 예보: 날짜별로 묶어 [날짜, 최저기온, 최고기온, 최대 강수확률] (날짜 오름차순)
    @Query("select cast(w.targetAt as LocalDate), min(w.temperatureC), max(w.temperatureC), max(w.precipitationProb)"
            + " from WeatherHourly w where w.areaId = :areaId and w.forecast = true"
            + " group by cast(w.targetAt as LocalDate) order by cast(w.targetAt as LocalDate)")
    List<Object[]> findDailyForecast(@Param("areaId") Long areaId, Limit limit);
}
