package com.mbc.puf.internal.devstub;

import org.apache.ibatis.annotations.Mapper;

/**
 * ⚠️ 임시(temp) 코드입니다.
 * FastAPI가 실제로 POST /api/internal/risk-scores 로 값을 주기적으로 밀어넣기 시작하면
 * 이 인터페이스와 짝이 되는 XML 매퍼, {@link WeatherStubRiskScoreScheduler} 까지
 * com.mbc.puf.internal.devstub 패키지 전체를 삭제하면 됩니다.
 *
 * weather_hourly(날씨) 데이터를 기반으로 지하차도별 risk_score를 주기적으로 만들어 넣어서,
 * 프런트(underpass-map.vue 등)가 "갱신 지연" 없이 최신 위험도/강수량을 받아오는지
 * 테스트할 수 있게 해줍니다. 여기서 계산하는 risk_score는 실제 AI 모델이 아니라
 * 강수량에 비례한 더미(stub) 값입니다.
 */
@Mapper
public interface WeatherStubRiskScoreDao {

    // 지하차도마다 가장 가까운 weather_area를 찾아 risk_score를 하나씩 새로 생성해 넣습니다.
    // 반환값은 insert된 행 수(대상 지하차도 수)입니다.
    int insertStubRiskScores();
}
