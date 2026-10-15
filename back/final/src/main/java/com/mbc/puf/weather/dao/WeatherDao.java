package com.mbc.puf.weather.dao;

import java.math.BigDecimal;
import java.util.List;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import com.mbc.puf.weather.dto.WeatherArea;
import com.mbc.puf.weather.dto.WeatherDailyRow;
import com.mbc.puf.weather.dto.UnderpassRainfallResponse;
import com.mbc.puf.weather.dto.WeatherHourlyRow;

@Mapper
public interface WeatherDao {

    // 위경도에서 가장 가까운 날씨 지역. 지역이 하나도 없으면 null
    WeatherArea selectNearestArea(@Param("lat") BigDecimal lat, @Param("lng") BigDecimal lng);

    // 지금 시각까지의 관측값 중 가장 최근 1건. 없으면 null
    WeatherHourlyRow selectCurrent(@Param("areaId") Long areaId);

    // 지금 이후 시간별 예보 N건 (시간 오름차순)
    List<WeatherHourlyRow> selectHourlyForecast(@Param("areaId") Long areaId, @Param("limit") int limit);

    // 지하차도 위치의 날씨 지역 관측값으로 계산한 강수 6개. 지하차도가 없으면 null
    UnderpassRainfallResponse selectUnderpassRainfall(@Param("underpassId") Long underpassId);

    // 날짜별로 묶은 예보 N일 (날짜 오름차순)
    List<WeatherDailyRow> selectDailyForecast(@Param("areaId") Long areaId, @Param("limit") int limit);
}
