package com.mbc.puf.weather.service;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;

import org.springframework.data.domain.Limit;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mbc.puf.common.exception.BusinessException;
import com.mbc.puf.common.jpa.DbClock;
import com.mbc.puf.weather.dto.UnderpassRainfallResponse;
import com.mbc.puf.weather.dto.WeatherResponse;
import com.mbc.puf.weather.entity.WeatherArea;
import com.mbc.puf.weather.entity.WeatherHourly;
import com.mbc.puf.weather.repository.WeatherAreaRepository;
import com.mbc.puf.weather.repository.WeatherHourlyRepository;

import jakarta.persistence.EntityManager;

@Service
public class WeatherServiceImpl implements WeatherService {

    private static final int HOURLY_LIMIT = 24;   // 시간별 예보: 앞으로 24시간
    private static final int DAILY_LIMIT = 7;     // 일별 예보: 7일

    private static final DateTimeFormatter OBSERVED_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");
    private static final DateTimeFormatter HOUR_FORMAT = DateTimeFormatter.ofPattern("H'시'");
    private static final DateTimeFormatter DAY_FORMAT = DateTimeFormatter.ofPattern("M/d(E)", Locale.KOREAN);

    /**
     * 지하차도 강수 (FastAPI 침수 모델 입력용). 지하차도 위치에서 가장 가까운 날씨 지역의 관측값으로
     * 이번 시간 / 직전 1시간 / 최근 3·6·12·24시간 누적(이번 시간 포함)을 계산한다.
     * CTE + FILTER 집계라 JPQL로 표현이 안 돼서 네이티브 SQL로 둔다 (예전 매퍼 SQL 그대로)
     */
    private static final String UNDERPASS_RAINFALL_SQL = """
            WITH u AS (
                SELECT id, name, lat, lng
                  FROM underpass
                 WHERE id = :underpassId AND is_deleted = FALSE
            ), a AS (
                SELECT wa.id, wa.name
                  FROM weather_area wa, u
                 ORDER BY power(wa.lat - u.lat, 2) + power(wa.lng - u.lng, 2)
                 LIMIT 1
            ), latest AS (
                SELECT MAX(h.target_at) AS t
                  FROM weather_hourly h, a
                 WHERE h.area_id = a.id AND h.is_forecast = FALSE AND h.target_at <= NOW()
            )
            SELECT u.id, u.name, a.name, l.t,
                   COALESCE(SUM(h.rain) FILTER (WHERE h.target_at = l.t), 0),
                   COALESCE(SUM(h.rain) FILTER (WHERE h.target_at = l.t - interval '1 hour'), 0),
                   COALESCE(SUM(h.rain) FILTER (WHERE h.target_at > l.t - interval '3 hours'), 0),
                   COALESCE(SUM(h.rain) FILTER (WHERE h.target_at > l.t - interval '6 hours'), 0),
                   COALESCE(SUM(h.rain) FILTER (WHERE h.target_at > l.t - interval '12 hours'), 0),
                   COALESCE(SUM(h.rain), 0)
              FROM u
             CROSS JOIN a
             CROSS JOIN latest l
              LEFT JOIN weather_hourly h
                     ON h.area_id = a.id AND h.is_forecast = FALSE
                    AND h.target_at <= l.t AND h.target_at > l.t - interval '24 hours'
             GROUP BY u.id, u.name, a.name, l.t
            """;

    private final WeatherAreaRepository areaRepository;
    private final WeatherHourlyRepository hourlyRepository;
    private final DbClock dbClock;
    private final EntityManager em;

    public WeatherServiceImpl(WeatherAreaRepository areaRepository, WeatherHourlyRepository hourlyRepository,
                              DbClock dbClock, EntityManager em) {
        this.areaRepository = areaRepository;
        this.hourlyRepository = hourlyRepository;
        this.dbClock = dbClock;
        this.em = em;
    }

    @Override
    @Transactional(readOnly = true)
    public WeatherResponse getWeather(BigDecimal lat, BigDecimal lng) {
        WeatherArea area = areaRepository.findNearest(lat, lng, Limit.of(1)).stream().findFirst()
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "날씨 지역 정보가 없습니다."));
        LocalDateTime now = dbClock.now();

        List<WeatherResponse.Hour> hourly = hourlyRepository
                .findByAreaIdAndForecastTrueAndTargetAtGreaterThanOrderByTargetAtAsc(area.getId(), now, Limit.of(HOURLY_LIMIT))
                .stream()
                .map(row -> new WeatherResponse.Hour(row.getTargetAt().format(HOUR_FORMAT),
                        row.getTemperatureC(), row.getRainfallMm(), row.getPrecipitationProb()))
                .toList();

        List<WeatherResponse.Day> daily = hourlyRepository.findDailyForecast(area.getId(), Limit.of(DAILY_LIMIT)).stream()
                .map(row -> new WeatherResponse.Day(((LocalDate) row[0]).format(DAY_FORMAT),
                        (BigDecimal) row[1], (BigDecimal) row[2], (Integer) row[3]))
                .toList();

        // 관측값이 아직 없으면 현재 날씨 칸은 비워 보낸다(화면에 "미수신"으로 표시됨)
        WeatherHourly current = hourlyRepository
                .findByAreaIdAndForecastFalseAndTargetAtLessThanEqualOrderByTargetAtDesc(area.getId(), now, Limit.of(1))
                .stream().findFirst().orElse(null);
        if (current == null) {
            return new WeatherResponse(area.getName(), null, null, null, null, null, hourly, daily);
        }
        return new WeatherResponse(area.getName(), current.getTemperatureC(), current.getHumidityPct(),
                current.getRainfallMm(), current.getCondition(), current.getTargetAt().format(OBSERVED_FORMAT),
                hourly, daily);
    }

    @Override
    @Transactional(readOnly = true)
    public UnderpassRainfallResponse getUnderpassRainfall(Long underpassId) {
        @SuppressWarnings("unchecked")
        List<Object[]> rows = em.createNativeQuery(UNDERPASS_RAINFALL_SQL)
                .setParameter("underpassId", underpassId)
                .getResultList();
        if (rows.isEmpty()) {
            throw new BusinessException(HttpStatus.NOT_FOUND, "존재하지 않는 지하차도입니다. underpassId=" + underpassId);
        }
        Object[] r = rows.get(0);
        UnderpassRainfallResponse rainfall = new UnderpassRainfallResponse();
        rainfall.setUnderpassId(((Number) r[0]).longValue());
        rainfall.setUnderpassName((String) r[1]);
        rainfall.setAreaName((String) r[2]);
        rainfall.setObservedAt(toLocalDateTime(r[3]));
        rainfall.setRainfallMm((BigDecimal) r[4]);
        rainfall.setRainfall1hMm((BigDecimal) r[5]);
        rainfall.setRainfall3hMm((BigDecimal) r[6]);
        rainfall.setRainfall6hMm((BigDecimal) r[7]);
        rainfall.setRainfall12hMm((BigDecimal) r[8]);
        rainfall.setRainfall24hMm((BigDecimal) r[9]);
        return rainfall;
    }

    private static LocalDateTime toLocalDateTime(Object value) {
        if (value == null) {
            return null;
        }
        return (value instanceof Timestamp ts) ? ts.toLocalDateTime() : (LocalDateTime) value;
    }
}
