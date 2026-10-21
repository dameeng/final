package com.mbc.puf.pm.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Map;

import com.mbc.puf.pm.entity.PmEquipmentType;

/**
 * 예지보전 점수 규칙 (화면 '기준 설정'의 기본값과 같음, front/src/data/pm-settings.json).
 *
 *  점수 = 항목별 (가중치 × min(1, 측정값 / 기준값)) 의 합. 가중치 합이 100 이라 점수는 0~100.
 *   예) 배수펌프 모터 전류 상승률 34% (기준 20%, 가중치 30) → 30점, 진동 5.8 (기준 7, 가중치 15) → 12.4점
 *
 * AI 모델이 아니라 규칙 기반 점수다. 가중치·기준값을 저장할 DB 테이블이 아직 없어서 여기 코드에 둔다.
 * 나중에 모델(FastAPI)이 점수를 직접 넣게 되면 pm_score 에 바로 INSERT 하면 되고, 이 계산은 안 써도 된다.
 */
public final class PmRules {

    /** 측정 항목 하나의 규칙. metric = pm_sensor.metric 에 저장되는 이름 */
    public record Rule(String metric, String label, String unit, BigDecimal limit, int weight) {

        /** 이 항목이 점수에 보태는 점수 (0 ~ weight) */
        public BigDecimal points(BigDecimal value) {
            if (value == null || value.signum() <= 0) {
                return BigDecimal.ZERO;
            }
            BigDecimal ratio = value.divide(limit, 4, RoundingMode.HALF_UP).min(BigDecimal.ONE);
            return ratio.multiply(BigDecimal.valueOf(weight)).setScale(1, RoundingMode.HALF_UP);
        }

        /** 화면 표시용 상태: 기준값 이상 '기준 초과', 기준값의 70% 이상 '주의', 그 밖 '정상' */
        public String status(BigDecimal value) {
            if (value == null) {
                return "미수신";
            }
            if (value.compareTo(limit) >= 0) {
                return "기준 초과";
            }
            return value.compareTo(limit.multiply(new BigDecimal("0.7"))) >= 0 ? "주의" : "정상";
        }
    }

    private static Rule rule(String metric, String label, String unit, String limit, int weight) {
        return new Rule(metric, label, unit, new BigDecimal(limit), weight);
    }

    private static final Map<PmEquipmentType, List<Rule>> RULES = Map.of(
            PmEquipmentType.PUMP, List.of(
                    rule("motor_current_rise", "모터 전류 상승률", "%", "20", 30),
                    rule("start_error_count", "기동 오류 횟수 (24시간)", "회", "5", 25),
                    rule("drain_response_delay", "배수 응답 지연", "초", "30", 20),
                    rule("vibration_index", "진동 지수", "", "7", 15),
                    rule("no_data_minutes", "데이터 미수신 시간", "분", "10", 10)),
            PmEquipmentType.DISPLAY, List.of(
                    rule("comm_delay", "통신 지연", "초", "3", 30),
                    rule("display_error_count", "표출 오류 횟수 (24시간)", "회", "3", 30),
                    rule("last_received_minutes", "마지막 수신 경과", "분", "10", 25),
                    rule("power_error_count", "전원·밝기 이상 횟수", "회", "2", 15)),
            PmEquipmentType.CCTV, List.of(
                    rule("stream_drop_count", "영상 끊김 횟수 (24시간)", "회", "5", 30),
                    rule("frame_loss_rate", "프레임 손실률", "%", "10", 25),
                    rule("last_received_minutes", "마지막 수신 경과", "분", "10", 25),
                    rule("image_quality_index", "화질 저하 지표", "", "6", 20)));

    // 점수가 주의 이상일 때 상세 화면에 보여 줄 권장 조치
    private static final Map<PmEquipmentType, String> ADVICE = Map.of(
            PmEquipmentType.PUMP, "펌프 모터와 배수 경로(흡입 필터·배관) 점검을 권장합니다.",
            PmEquipmentType.DISPLAY, "통신 회선과 전원부 점검을 권장합니다.",
            PmEquipmentType.CCTV, "카메라 전원·네트워크와 렌즈 상태 점검을 권장합니다.");

    // 점검 때문에 지하차도를 막을 때 쓰는 차단 사유 (팀 seed 의 reason_preset BLOCK 문구와 같게)
    private static final Map<PmEquipmentType, String> BLOCK_REASON = Map.of(
            PmEquipmentType.PUMP, "배수펌프 고장으로 인한 침수 위험",
            PmEquipmentType.DISPLAY, "시설물 긴급 점검",
            PmEquipmentType.CCTV, "시설물 긴급 점검");

    private PmRules() {
    }

    public static String blockReason(PmEquipmentType type) {
        return BLOCK_REASON.get(type);
    }

    /**
     * 사유 문장: 점수를 보탠 항목을 큰 순서로 요약.
     *  예) "모터 전류 상승률 34% (기준 20%) 외 2건", 보탠 항목이 없으면 "이상 항목 없음"
     */
    public static String reason(PmEquipmentType type, Map<String, BigDecimal> values) {
        List<Rule> hits = of(type).stream()
                .filter(r -> r.points(values.get(r.metric())).signum() > 0)
                .sorted((a, b) -> b.points(values.get(b.metric())).compareTo(a.points(values.get(a.metric()))))
                .toList();
        if (hits.isEmpty()) {
            return "이상 항목 없음";
        }
        Rule top = hits.get(0);
        String text = top.label() + " " + plain(values.get(top.metric())) + top.unit()
                + " (기준 " + plain(top.limit()) + top.unit() + ")";
        return hits.size() == 1 ? text : text + " 외 " + (hits.size() - 1) + "건";
    }

    private static String plain(BigDecimal v) {
        return v.stripTrailingZeros().toPlainString();
    }

    public static List<Rule> of(PmEquipmentType type) {
        return RULES.get(type);
    }

    public static Rule find(PmEquipmentType type, String metric) {
        return of(type).stream().filter(r -> r.metric().equals(metric)).findFirst().orElse(null);
    }

    public static String advice(PmEquipmentType type) {
        return ADVICE.get(type);
    }

    /** 측정값 묶음(metric → value)으로 점수 계산. 빠진 항목은 0점 */
    public static BigDecimal score(PmEquipmentType type, Map<String, BigDecimal> values) {
        BigDecimal sum = BigDecimal.ZERO;
        for (Rule r : of(type)) {
            sum = sum.add(r.points(values.get(r.metric())));
        }
        return sum.min(new BigDecimal("100")).setScale(2, RoundingMode.HALF_UP);
    }
}
