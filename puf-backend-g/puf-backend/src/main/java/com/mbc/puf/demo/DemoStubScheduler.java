package com.mbc.puf.demo;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import com.mbc.puf.common.jpa.DbClock;
import com.mbc.puf.stream.StreamPublisher;
import com.mbc.puf.weather.entity.WeatherArea;
import com.mbc.puf.weather.service.KmaClient;
import com.mbc.puf.weather.service.WeatherCollectService;

import tools.jackson.databind.JsonNode;

/**
 * 시연용 가짜 기상청·침수모델·수위계를 10초마다 한 번씩 돌린다 (puf.demo.enabled=true 일 때만).
 *
 *  - 호우 시나리오 중인 지역: 10초마다 새 값 (기상청 관측·예보 → 침수모델 점수·예측 → 수위계)
 *  - 그 밖의 지역: 1분마다 잔잔한 값 (예보·예측은 10분마다, 수위는 5분마다)
 *
 * 침수모델·수위계는 실제와 똑같이 HTTP 로 내부 API(/api/internal/**)를 호출한다.
 * 시나리오는 선택한 지역에만 적용되므로 다른 지역에는 알림이 가지 않는다.
 */
@Component
@ConditionalOnProperty(name = "puf.demo.enabled", havingValue = "true")
public class DemoStubScheduler {

    private static final Logger log = LoggerFactory.getLogger(DemoStubScheduler.class);

    private static final int CALM_SCORE_EVERY = 6;      // 10초 × 6 = 1분
    private static final int CALM_WATER_EVERY = 30;     // 5분
    private static final int CALM_FORECAST_EVERY = 60;  // 10분
    private static final int FORECAST_HOURS = 6;        // 위험도 미래 예측: 앞으로 6시간

    private final DemoScenarioState state;
    private final DemoScenarioService scenarioService;
    private final DemoInternalApi api;
    private final KmaClient kmaClient;
    private final WeatherCollectService weatherCollect;
    private final DbClock dbClock;
    private final StreamPublisher streamPublisher;

    private long tickCount = 0;

    public DemoStubScheduler(DemoScenarioState state, DemoScenarioService scenarioService, DemoInternalApi api,
                             KmaClient kmaClient, WeatherCollectService weatherCollect, DbClock dbClock,
                             StreamPublisher streamPublisher) {
        this.state = state;
        this.scenarioService = scenarioService;
        this.api = api;
        this.kmaClient = kmaClient;
        this.weatherCollect = weatherCollect;
        this.dbClock = dbClock;
        this.streamPublisher = streamPublisher;
    }

    @Scheduled(initialDelay = 15_000, fixedDelay = 10_000)
    public void tick() {
        try {
            run();
        } catch (RuntimeException e) {
            log.warn("[demo] stub tick failed: {}", e.toString());
        }
    }

    private void run() {
        long n = tickCount++;
        boolean calmScore = n % CALM_SCORE_EVERY == 0;
        boolean calmWater = n % CALM_WATER_EVERY == 0;
        boolean calmForecast = n % CALM_FORECAST_EVERY == 0;

        // 시나리오가 끝났거나 중지됐으면 전체를 잔잔한 값으로 한 번 되돌린다 (수위 0, 점수 평소 값, 예보 평소 값)
        if (state.finished()) {
            scenarioService.finishNow();
        }
        if (state.takeReset()) {
            calmScore = true;
            calmWater = true;
            calmForecast = true;
        }

        DemoScenarioState.Run r = state.current();
        List<WeatherArea> areas = weatherCollect.allAreas();
        List<Long> allUnderpasses = scenarioService.allUnderpassIds();

        // ---- 1) 기상청: 관측값/예보 저장 ----
        for (WeatherArea area : areas) {
            boolean active = state.isAreaActive(area.getId());
            if (active || calmScore) {
                weatherCollect.saveObservation(area, kmaClient.fetchObservation(area));
            }
            if (active || calmForecast) {
                weatherCollect.saveForecast(area, kmaClient.fetchForecast(area));
            }
        }
        if (calmForecast) {
            weatherCollect.purgeOldObservations();
        }

        // ---- 2) 침수모델 + 3) 수위계 ----
        double t = state.scenarioSec();
        for (Long uid : allUnderpasses) {
            boolean active = r != null && state.isUnderpassActive(uid);
            if (!active && !calmScore) {
                continue;
            }
            try {
                modelStub(uid, active);
                if (active || calmWater) {
                    waterStub(uid, active, t);
                }
                if (active || calmForecast) {
                    forecastStub(uid, active);
                }
            } catch (RuntimeException e) {
                log.warn("[demo] stub failed for underpass {}: {}", uid, e.toString());
            }
        }

        // ---- 단계가 바뀌면 프런트에 알림 ----
        if (r != null) {
            DemoScenarioState.Phase phase = state.phaseAt(t);
            if (phase != state.lastPublishedPhase()) {
                state.markPublished(phase);
                streamPublisher.dataChangedPublic(null, "demo-scenario", "UPDATE", null);
            }
        }
    }

    // 침수모델 흉내: 강수(내부 API)를 읽어 위험점수를 계산해 보낸다
    private void modelStub(Long uid, boolean active) {
        JsonNode rain = api.rainfall(uid);
        if (rain == null || rain.isNull()) {
            return;
        }
        double current = num(rain, "rainfallMm");
        double baseline = 3 + (uid % 7);
        double score;
        if (active) {
            double factor = 0.9 + (uid % 5) * 0.05;
            double target = 100 * (1 - Math.exp(-(current * factor) / 4.0));
            score = state.nextScore(uid, target, baseline);
        } else {
            state.resetScore(uid);
            score = baseline + (System.currentTimeMillis() / 60000 + uid) % 3;   // 잔잔한 값이 조금씩 움직이게
        }
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("underpassId", uid);
        body.put("riskScore", dec(Math.min(100, score), 2));
        body.put("rainfallMm", rain.get("rainfallMm"));
        body.put("rainfall1hMm", rain.get("rainfall1hMm"));
        body.put("rainfall3hMm", rain.get("rainfall3hMm"));
        body.put("rainfall6hMm", rain.get("rainfall6hMm"));
        body.put("rainfall12hMm", rain.get("rainfall12hMm"));
        body.put("rainfall24hMm", rain.get("rainfall24hMm"));
        body.put("predictedAt", dbClock.now().truncatedTo(ChronoUnit.MILLIS));
        api.postRiskScore(body);
    }

    // 침수모델 흉내(미래): 예보(내부 API)를 읽어 앞으로 6시간의 위험점수를 계산해 보낸다
    private void forecastStub(Long uid, boolean active) {
        JsonNode forecast = api.forecast(uid);
        if (forecast == null || !forecast.isArray()) {
            return;
        }
        double factor = 0.9 + (uid % 5) * 0.05;
        double baseline = 3 + (uid % 7);
        LocalDateTime now = dbClock.now().truncatedTo(ChronoUnit.MILLIS);
        List<Map<String, Object>> items = new ArrayList<>();
        int count = 0;
        for (JsonNode f : forecast) {
            if (count++ >= FORECAST_HOURS) {
                break;
            }
            double rain = num(f, "rainfallMm");
            double score = Math.max(baseline, 100 * (1 - Math.exp(-(rain * factor) / 30.0)));
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("targetAt", f.get("targetAt"));
            item.put("riskScore", dec(Math.min(100, score), 2));
            item.put("rainfallMm", f.get("rainfallMm"));
            items.add(item);
        }
        if (items.isEmpty()) {
            return;
        }
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("underpassId", uid);
        body.put("predictedAt", now);
        body.put("items", items);
        api.postRiskForecast(body);
    }

    // 수위계 흉내: 시나리오 중에는 곡선대로, 평소에는 0 근처
    private void waterStub(Long uid, boolean active, double t) {
        double level = active ? state.waterAt(t) : (uid % 4) * 0.1;
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("underpassId", uid);
        body.put("levelCm", dec(level, 1));
        body.put("measuredAt", dbClock.now().truncatedTo(ChronoUnit.MILLIS));
        api.postWaterLevel(body);
    }

    private static double num(JsonNode node, String field) {
        JsonNode v = node.get(field);
        return v == null || v.isNull() ? 0 : v.asDouble();
    }

    private static BigDecimal dec(double v, int scale) {
        return BigDecimal.valueOf(v).setScale(scale, RoundingMode.HALF_UP);
    }
}
