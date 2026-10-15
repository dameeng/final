package com.mbc.puf.internal.devstub;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * ⚠️ 임시(temp) 스케줄러입니다.
 * FastAPI가 실제로 POST /api/internal/risk-scores 를 주기적으로 호출하기 시작하면
 * com.mbc.puf.internal.devstub 패키지 전체를 삭제하면 됩니다.
 *
 * weather_hourly 데이터를 이용해 60초마다 risk_score를 채워 넣어서, 프런트에서
 * "갱신 지연" 없이 위험도/강수량이 살아있는 상태로 테스트할 수 있게 합니다.
 * current_risk_level / underpass_event는 건드리지 않습니다(실제 위험도 판정 로직과는 무관).
 *
 * application.yml 등에 puf.weather-stub.enabled=false 를 추가하면 언제든 끌 수 있습니다.
 * (기본값은 켜짐이라 별도 설정이 없어도 바로 동작합니다.)
 *
 * FinalApplication에 이미 @EnableScheduling이 있어 추가 설정은 필요 없습니다.
 */
@Component
@ConditionalOnProperty(name = "puf.weather-stub.enabled", havingValue = "true", matchIfMissing = true)
public class WeatherStubRiskScoreScheduler {

    private final WeatherStubRiskScoreDao weatherStubRiskScoreDao;

    public WeatherStubRiskScoreScheduler(WeatherStubRiskScoreDao weatherStubRiskScoreDao) {
        this.weatherStubRiskScoreDao = weatherStubRiskScoreDao;
    }

    // 프런트 "갱신 지연" 임계값(2분)보다 넉넉히 짧게 60초마다 갱신
    @Scheduled(fixedRate = 60_000)
    public void run() {
        weatherStubRiskScoreDao.insertStubRiskScores();
    }
}
