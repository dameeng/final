package com.mbc.puf.weather.service;

import java.math.BigDecimal;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mbc.puf.common.exception.BusinessException;
import com.mbc.puf.weather.dao.WeatherDao;
import com.mbc.puf.weather.dto.UnderpassRainfallResponse;
import com.mbc.puf.weather.dto.WeatherArea;
import com.mbc.puf.weather.dto.WeatherHourlyRow;
import com.mbc.puf.weather.dto.WeatherResponse;

@Service
public class WeatherServiceImpl implements WeatherService {

    private static final int HOURLY_LIMIT = 24;   // 시간별 예보: 앞으로 24시간
    private static final int DAILY_LIMIT = 7;     // 일별 예보: 7일

    private static final DateTimeFormatter OBSERVED_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");
    private static final DateTimeFormatter HOUR_FORMAT = DateTimeFormatter.ofPattern("H'시'");
    private static final DateTimeFormatter DAY_FORMAT = DateTimeFormatter.ofPattern("M/d(E)", Locale.KOREAN);

    private final WeatherDao weatherDao;

    public WeatherServiceImpl(WeatherDao weatherDao) {
        this.weatherDao = weatherDao;
    }

    @Override
    @Transactional(readOnly = true)
    public WeatherResponse getWeather(BigDecimal lat, BigDecimal lng) {
        WeatherArea area = weatherDao.selectNearestArea(lat, lng);
        if (area == null) {
            throw new BusinessException(HttpStatus.NOT_FOUND, "날씨 지역 정보가 없습니다.");
        }

        List<WeatherResponse.Hour> hourly = weatherDao.selectHourlyForecast(area.getId(), HOURLY_LIMIT).stream()
                .map(row -> new WeatherResponse.Hour(row.getTargetAt().format(HOUR_FORMAT),
                        row.getTemperatureC(), row.getRainfallMm(), row.getPrecipitationProb()))
                .toList();

        List<WeatherResponse.Day> daily = weatherDao.selectDailyForecast(area.getId(), DAILY_LIMIT).stream()
                .map(row -> new WeatherResponse.Day(row.getForecastDate().format(DAY_FORMAT),
                        row.getMinTemperature(), row.getMaxTemperature(), row.getPrecipitationProb()))
                .toList();

        // 관측값이 아직 없으면 현재 날씨 칸은 비워 보낸다(화면에 "미수신"으로 표시됨)
        WeatherHourlyRow current = weatherDao.selectCurrent(area.getId());
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
        UnderpassRainfallResponse rainfall = weatherDao.selectUnderpassRainfall(underpassId);
        if (rainfall == null) {
            throw new BusinessException(HttpStatus.NOT_FOUND, "존재하지 않는 지하차도입니다. underpassId=" + underpassId);
        }
        return rainfall;
    }
}
