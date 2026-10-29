package com.mbc.puf.demo;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import com.mbc.puf.common.enums.RiskLevel;
import com.mbc.puf.common.exception.BusinessException;
import com.mbc.puf.common.jpa.DbClock;
import com.mbc.puf.risk.RiskPolicy;
import com.mbc.puf.threshold.entity.Threshold;
import com.mbc.puf.threshold.repository.ThresholdRepository;
import com.mbc.puf.underpass.entity.Underpass;
import com.mbc.puf.underpass.repository.UnderpassRepository;

import tools.jackson.databind.JsonNode;

/**
 * [시연용·로컬] 지하차도 위험 5단계를 버튼으로 직접 고르는 기능 (puf.demo.enabled=true 일 때만).
 *
 * 단계를 DB 에 직접 쓰지 않는다. 실제 침수모델·수위계가 하는 것과 똑같이 "위험점수"와 "수위" 값을 내부 API 로 넣고,
 * 단계 판정(RiskPolicy) → 이벤트·알림·전광판·자동 통제·내비 우회·접근/최종 알림 판단은 원래 로직이 그대로 한다.
 *
 *   안전 : 점수 5,  수위 0
 *   관심 : 점수 = 관심 하한 + 2,  수위 0
 *   주의 : 점수 = 주의 하한 + 2,  수위 0
 *   경계 : 점수 = 주의 구간,  수위 = 통제 수위 + 0.5   → 자동 통제까지 일어난다
 *   심각 : 점수 = 주의 구간,  수위 = 통제 수위 + 심각 추가분 + 0.5
 *
 * 로컬에서는 진짜 침수 서버(FastAPI 8001)가 점수·예측을 계속 보내므로, 고른 지하차도는 "고정(pin)" 한다.
 *  - 고정된 지하차도의 점수·예측은 진짜 침수 서버가 보내도 InternalController 에서 무시한다 (이 서비스가 보내는 값만 통과)
 *  - 스케줄러(DemoStubScheduler)도 고정된 지하차도는 건드리지 않는다 (호우 시나리오·평상시 가짜 갱신·수위 생성 모두)
 *  - 이 서비스가 10초마다 같은 값을 다시 넣어 "갱신 지연"이 안 뜨고 값이 유지된다
 * 고정을 풀면 진짜 침수 서버 점수와 평상시 갱신이 다시 이어받는다. 통제된 지하차도의 해제는 관리자 화면에서 직접 한다(수위가 통제 수위 미만이어야 가능).
 */
@Service
@ConditionalOnProperty(name = "puf.demo.enabled", havingValue = "true")
public class DemoLevelService {

    private static final Logger log = LoggerFactory.getLogger(DemoLevelService.class);
    private static final int FORECAST_HOURS = 6;
    private static final int FORECAST_EVERY = 6;   // 고정값 예측은 6번(약 1분)에 한 번 다시 넣는다 (지난 시점이 지워져도 6시간치가 유지되게)

    /** 고정한 값 */
    public record Pin(RiskLevel level, BigDecimal score, BigDecimal waterCm) {}

    private final UnderpassRepository underpassRepository;
    private final ThresholdRepository thresholdRepository;
    private final RiskPolicy policy;
    private final DemoInternalApi api;
    private final DemoWaterProfile waterProfile;
    private final DbClock dbClock;
    private final JdbcTemplate jdbc;
    private final List<String> targetNames;
    private final BigDecimal severeExtraCm;

    private final Map<Long, Pin> pins = new ConcurrentHashMap<>();
    private int refreshCount = 0;

    public DemoLevelService(UnderpassRepository underpassRepository, ThresholdRepository thresholdRepository,
                            RiskPolicy policy, DemoInternalApi api, DemoWaterProfile waterProfile, DbClock dbClock,
                            JdbcTemplate jdbc,
                            @Value("${puf.demo.level-target-names:초량지하차도,북항지하차도,충장지하차도}") String targets,
                            @Value("${puf.risk.water.severe-extra-cm:15}") BigDecimal severeExtraCm) {
        this.underpassRepository = underpassRepository;
        this.thresholdRepository = thresholdRepository;
        this.policy = policy;
        this.api = api;
        this.waterProfile = waterProfile;
        this.dbClock = dbClock;
        this.jdbc = jdbc;
        this.targetNames = Arrays.stream(targets.split(",")).map(String::trim).filter(x -> !x.isEmpty()).toList();
        this.severeExtraCm = severeExtraCm;
    }

    /** 스케줄러·InternalController 가 묻는다: 이 지하차도는 시연 단계로 고정돼 있는가 */
    public boolean isPinned(Long underpassId) {
        return underpassId != null && pins.containsKey(underpassId);
    }

    /** 시연 대상 지하차도 (이름으로 찾는다. 시드 기준 초량·북항·충장). 이름은 puf.demo.level-target-names 로 바꾼다 */
    public List<Underpass> targets() {
        List<Underpass> result = new ArrayList<>();
        for (String name : targetNames) {
            for (Long id : jdbc.queryForList("SELECT id FROM underpass WHERE name = ? AND is_deleted = FALSE ORDER BY id", Long.class, name)) {
                underpassRepository.findByIdAndDeletedFalse(id).ifPresent(result::add);
            }
        }
        return result;
    }

    public List<Map<String, Object>> list() {
        List<Map<String, Object>> rows = new ArrayList<>();
        for (Underpass u : targets()) {
            Pin pin = pins.get(u.getId());
            RiskLevel level = u.getCurrentRiskLevel() == null ? RiskLevel.SAFE : u.getCurrentRiskLevel();
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("underpassId", u.getId());
            row.put("name", u.getName());
            row.put("level", level.name());
            row.put("levelLabel", level.getDbValue());
            row.put("riskScore", u.getCurrentRiskScore());
            row.put("waterCm", u.getCurrentWaterCm());
            row.put("status", u.getCurrentStatus() == null ? null : u.getCurrentStatus().name());
            row.put("blockCm", policy.blockCm(u));
            row.put("pinnedLevel", pin == null ? null : pin.level().name());
            rows.add(row);
        }
        return rows;
    }

    /** 고른 지하차도들을 해당 단계로 만들고 고정한다 (underpassIds 가 비어 있으면 대상 전체) */
    public List<Map<String, Object>> set(List<Long> underpassIds, RiskLevel level) {
        if (level == null) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "level 이 필요합니다. (SAFE|WATCH|CAUTION|ALERT|SEVERE)");
        }
        List<Underpass> chosen = pick(underpassIds);
        for (Underpass u : chosen) {
            Pin pin = pinFor(u, level);
            pins.put(u.getId(), pin);
            waterProfile.sync(u.getId(), pin.waterCm().doubleValue());
            push(u.getId(), pin, true);
        }
        log.info("[DEMO] 위험단계 {} 고정: {}", level, chosen.stream().map(Underpass::getName).toList());
        return list();
    }

    /** 고정 풀기 (underpassIds 가 비어 있으면 전체). 이후 진짜 침수 서버 점수가 이어받고, 수위는 10초에 2cm씩 내려간다 */
    public List<Map<String, Object>> release(List<Long> underpassIds) {
        if (underpassIds == null || underpassIds.isEmpty()) {
            pins.clear();
        } else {
            underpassIds.forEach(pins::remove);
        }
        log.info("[DEMO] 위험단계 고정 해제: {}", underpassIds == null || underpassIds.isEmpty() ? "전체" : underpassIds);
        return list();
    }

    /** 스케줄러가 10초마다 부른다: 고정된 값을 다시 넣어 "갱신 지연"이 안 뜨고 값이 유지되게 한다 */
    public void refreshPinned() {
        if (pins.isEmpty()) {
            return;
        }
        boolean withForecast = refreshCount++ % FORECAST_EVERY == 0;
        pins.forEach((uid, pin) -> {
            try {
                push(uid, wobble(pin), withForecast);
            } catch (RuntimeException e) {
                log.warn("[DEMO] 고정값 갱신 실패 underpass {}: {}", uid, e.toString());
            }
        });
    }

    // 고정값을 다시 넣을 때 점수·수위를 ±0.3 안에서 조금씩 흔든다. 값이 계속 움직이는 것처럼 보이고(그래프도 이어진다),
    // 단계 경계(점수 하한+2, 통제 수위+0.5)에서 0.2 이상 떨어져 있어서 단계는 바뀌지 않는다. 수위 0 은 그대로 0.
    private static Pin wobble(Pin pin) {
        var random = java.util.concurrent.ThreadLocalRandom.current();
        BigDecimal score = pin.score().add(BigDecimal.valueOf((random.nextDouble() * 2 - 1) * 0.3))
                .max(BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP);
        BigDecimal water = pin.waterCm().signum() > 0
                ? pin.waterCm().add(BigDecimal.valueOf((random.nextDouble() * 2 - 1) * 0.3)).setScale(1, RoundingMode.HALF_UP)
                : pin.waterCm();
        return new Pin(pin.level(), score, water);
    }

    // ---------------------------------------------------------------- 값 계산

    private List<Underpass> pick(List<Long> ids) {
        List<Underpass> all = targets();
        if (ids == null || ids.isEmpty()) {
            return all;
        }
        List<Underpass> chosen = all.stream().filter(u -> ids.contains(u.getId())).toList();
        if (chosen.isEmpty()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "시연 대상 지하차도가 아닙니다.");
        }
        return chosen;
    }

    private Pin pinFor(Underpass u, RiskLevel level) {
        List<Threshold> thresholds = thresholdRepository.findByUnderpassIdOrderByRiskScoreMinAsc(u.getId());
        BigDecimal block = policy.blockCm(u);
        BigDecimal score;
        BigDecimal water = BigDecimal.ZERO;
        switch (level) {
            case SAFE -> score = BigDecimal.valueOf(5);
            case WATCH -> score = minOf(thresholds, RiskLevel.WATCH).add(BigDecimal.valueOf(2));
            case CAUTION -> score = minOf(thresholds, RiskLevel.CAUTION).add(BigDecimal.valueOf(2));
            case ALERT -> {
                score = minOf(thresholds, RiskLevel.CAUTION).add(BigDecimal.valueOf(2));
                water = block.add(BigDecimal.valueOf(0.5));
            }
            case SEVERE -> {
                score = minOf(thresholds, RiskLevel.CAUTION).add(BigDecimal.valueOf(2));
                water = block.add(severeExtraCm).add(BigDecimal.valueOf(0.5));
            }
            default -> throw new BusinessException(HttpStatus.BAD_REQUEST, "알 수 없는 단계");
        }
        return new Pin(level, score.setScale(2, RoundingMode.HALF_UP), water.setScale(1, RoundingMode.HALF_UP));
    }

    private static BigDecimal minOf(List<Threshold> thresholds, RiskLevel level) {
        return thresholds.stream().filter(t -> t.getLevel() == level).map(Threshold::getRiskScoreMin).findFirst()
                .orElse(BigDecimal.valueOf(switch (level) {
                    case WATCH -> 40;
                    case CAUTION -> 70;
                    default -> 0;
                }));
    }

    // ---------------------------------------------------------------- 넣기 (실제 침수모델·수위계와 같은 내부 API, 고정 통과 표시 포함)

    private void push(Long uid, Pin pin, boolean withForecast) {
        // 단계가 내려갈 때 중간에 한 단계 더 높게 판정되지 않도록: 수위를 먼저, 점수를 나중에 넣는다
        postWater(uid, pin.waterCm());
        postScore(uid, pin.score());
        if (withForecast) {
            postForecast(uid, pin.score());
        }
    }

    private void postWater(Long uid, BigDecimal water) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("underpassId", uid);
        body.put("levelCm", water);
        body.put("measuredAt", dbClock.now().truncatedTo(ChronoUnit.MILLIS));
        api.postWaterLevel(body, true);
    }

    private void postScore(Long uid, BigDecimal score) {
        JsonNode rain = api.rainfall(uid);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("underpassId", uid);
        body.put("riskScore", score);
        for (String key : new String[] {"rainfallMm", "rainfall1hMm", "rainfall3hMm", "rainfall6hMm", "rainfall12hMm", "rainfall24hMm"}) {
            JsonNode v = rain == null ? null : rain.get(key);
            body.put(key, v == null || v.isNull() ? BigDecimal.ZERO : v.decimalValue());
        }
        body.put("predictedAt", dbClock.now().truncatedTo(ChronoUnit.MILLIS));
        api.postRiskScore(body, true);
    }

    // 예측 그래프도 같은 점수로 평평하게 (진짜 침수 서버·평상시 랜덤값이 섞이지 않게)
    private void postForecast(Long uid, BigDecimal score) {
        JsonNode forecast = api.forecast(uid);
        if (forecast == null || !forecast.isArray()) {
            return;
        }
        List<Map<String, Object>> items = new ArrayList<>();
        int count = 0;
        for (JsonNode f : forecast) {
            if (count++ >= FORECAST_HOURS) {
                break;
            }
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("targetAt", f.get("targetAt"));
            item.put("riskScore", score);
            item.put("rainfallMm", f.get("rainfallMm"));
            items.add(item);
        }
        if (items.isEmpty()) {
            return;
        }
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("underpassId", uid);
        body.put("predictedAt", dbClock.now().truncatedTo(ChronoUnit.MILLIS));
        body.put("items", items);
        api.postRiskForecast(body, true);
    }
}
