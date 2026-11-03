package com.mbc.puf.demo;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.Map;

/**
 * 평상시(호우 시나리오가 아닐 때) 시연용 날씨. 침수모델(FastAPI)이 이 비를 읽어 점수를 계산하므로,
 * 서버를 켰을 때 지하차도 단계가 어떻게 보일지는 여기서 정한다.
 *
 * 침수모델은 계단식이라(일정한 비에서 0~1점 → 곧바로 65점 → 90점대) 비 세기를 조금만 바꿔도 단계가 확 바뀐다.
 * 그래서 이 클래스는 날씨 지역마다 "단계가 옮겨 다니지 않는" 비를 만든다. 시각만으로 값이 정해지므로(난수 없음)
 * 서버를 껐다 켜도, 과거 날씨를 채울 때도 같은 비가 이어지고, 켜자마자 단계가 정해져 있다.
 *
 * 1) 일정한 비 (STEADY_MM): 날씨 지역마다 세기가 정해져 있고 ±3% 만 천천히 흔들린다. 지하차도 단계는 높이·길이에 따라 갈린다
 *    (침수모델로 확인: 세기 6~8.5 안전 위주 / 8~11 안전+관심 / 11~12 관심+주의 / 17 주의). 구마다 단계가 고정이라 전광판·알림이 오르내리지 않는다.
 * 2) 10점 안팎으로 움직이는 비 (BURST): 중구·동구 날씨 지역. 일정한 비로는 이 모델이 0점이거나 65점이라 10점대를 못 만든다.
 *    짧고 센 비가 주기적으로 지나가게 해서 점수가 안전 범위(약 0~20점) 안에서 오르내리게 한다.
 *    (충장 10~13점 / 초량 1~17점 평균 7 / 북항 9~22점. 부산진시장·가야감고개는 민감도가 낮아 0~1점에 머문다 — 비로는 한계)
 *    중구·동구 날씨를 받는 지하차도(초량·부산진시장·북항·충장·가야감고개)는 호우 시나리오 시연 전까지 항상 안전이다.
 *
 * 단계를 바꾸고 싶으면 STEADY_MM 의 지역 값을 바꾼다 (침수모델 응답은 DemoCalmRain 을 직접 돌려 확인할 것).
 * 수위는 평상시 상한(calm-water-max-cm)에 막혀 경계·심각·자동 통제까지는 가지 않는다.
 * 지하차도는 구(region)가 아니라 "가장 가까운 날씨 지역"의 비를 받는다 (weather_area id 는 2.seed_general 순서: 중구=1, 서구=2, 동구=3 ...).
 */
public final class DemoCalmRain {

    private static final double DEFAULT_STEADY_MM = 4;      // 아래 표에 없는 날씨 지역(지하차도가 없는 구) 비 세기 mm/h
    private static final double STEADY_WOBBLE = 0.03;       // 일정한 비의 흔들림 폭(±3%) — 단계가 안 바뀌는 범위 안
    private static final Map<Long, Double> STEADY_MM = Map.ofEntries(
            Map.entry(5L, 11.0),    // 부산진구: 관심 3
            Map.entry(6L, 6.5),     // 동래구  : 안전 6
            Map.entry(7L, 8.0),     // 남구    : 안전 1 / 관심 1
            Map.entry(8L, 8.0),     // 북구    : 안전 2 / 관심 1
            Map.entry(9L, 6.0),     // 해운대구: 안전 3
            Map.entry(10L, 11.25),  // 사하구  : 관심 2 / 주의 2
            Map.entry(11L, 6.0),    // 금정구  : 안전 2
            Map.entry(12L, 8.5),    // 강서구  : 안전 3 / 관심 1
            Map.entry(14L, 7.0),    // 수영구  : 안전 3 / 관심 1
            Map.entry(15L, 8.0),    // 사상구  : 안전 6 / 관심 2
            Map.entry(16L, 17.0));  // 기장군  : 주의 1

    // {주기(시간), 폭 σ(시간), 최고 세기 mm/h, 바닥 비 mm/h}
    private static final Map<Long, double[]> BURST = Map.of(
            1L, new double[] { 6.0, 0.6, 10, 4.0 },     // 중구(충장)
            3L, new double[] { 2.0, 0.3, 25, 1.0 });    // 동구(초량·부산진시장·북항, 가야감고개)

    private DemoCalmRain() {
    }

    /** 그 시각 그 지역의 강수 세기 (mm/h) */
    public static double intensity(long areaId, LocalDateTime t) {
        double hours = t.toEpochSecond(ZoneOffset.UTC) / 3600.0;
        double[] b = BURST.get(areaId);
        if (b != null) {
            double k = hours / b[0];
            double x = (k - Math.floor(k) - 0.5) * b[0];
            return b[3] + b[2] * Math.exp(-(x / b[1]) * (x / b[1]));
        }
        double base = STEADY_MM.getOrDefault(areaId, DEFAULT_STEADY_MM);
        double wobblePeriod = 2.5 + (areaId % 3) * 0.5;
        return base * (1 + STEADY_WOBBLE * Math.sin(2 * Math.PI * hours / wobblePeriod + areaId));
    }

    /** 관측 한 건(minutes 분 간격)에 쌓일 강수량 (mm) */
    public static double rainPerObservation(long areaId, LocalDateTime t, int minutes) {
        return intensity(areaId, t) * minutes / 60.0;
    }
}
