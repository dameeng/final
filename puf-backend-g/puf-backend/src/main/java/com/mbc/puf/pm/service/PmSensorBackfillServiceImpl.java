package com.mbc.puf.pm.service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mbc.puf.common.enums.PmEquipmentType;
import com.mbc.puf.common.exception.BusinessException;
import com.mbc.puf.common.jpa.DbClock;
import com.mbc.puf.pm.dto.PmSensorBackfillResponse;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;

/**
 * 센서 과거 데이터를 DB 안에서 generate_series 로 한 번에 만든다 (행마다 자바를 거치지 않아 빠르다).
 *
 * 값의 평소 범위는 예지보전 모델 폴더의 샘플 데이터(CCTV·펌프)와 팀원 모델 기준값(전광판)에서 가져왔다.
 *   펌프  진동 980±2 / 압력 1013±14 / 온도 2.5 / 전류 1.1 / 유량 36 / 회전수 38   (이상: 진동·압력·온도·유량·회전수 하락, 전류 상승)
 *   CCTV  수신률 99% / 응답 49ms / 손실 0.18% / 흐림 6.6                          (이상: 수신률 하락, 응답·손실·흐림 상승)
 *   전광판 본체-외기 6.5℃ / 리플 0.028V / 응답 43ms / 오류 시간당 약 0.1건 / 불량화소 0.015%
 *          (이상 원인 4가지: 열 / 전원 / 통신 / 화면 — 설비 번호 순서대로)
 *   수위  0.30m 기준 하루 주기 ±0.02 + 잡음            (이상: 서서히 올라가는 드리프트 + 잡음 증가)
 *
 * 설비 종류별 번호(rk, id 순)에 따라 시나리오가 정해진다:  rk%4==1 위험까지 악화 / 2 주의까지 악화 / 3 계속 정상 / 0 중간에 한 번 튀었다 복구.
 * 악화는 끝 시각에 가까울수록 커지는 곡선이고 시작 시점은 종류마다 다르다(펌프 3일 전, CCTV·전광판 6일 전, 수위 2일 전).
 * 값은 모델 점수에 직접 맞춰 보정한 것이 아니라서, 단계(주의/위험)가 의도대로 나오는지는 예지보전 서버로 점수를 내 보고 상수를 조정한다.
 */
@Service
public class PmSensorBackfillServiceImpl implements PmSensorBackfillService {

    private static final double CAUTION_AMP = 0.35;
    private static final String NOISE = "((random() + random() + random() - 1.5) * 2)";   // 평균 0, 표준편차 약 1

    /** 설비 종류별 만드는 방법 */
    private record Spec(PmEquipmentType type, String table, long rampSec, long spikeLenSec, String insertSql) {
    }

    private static final Spec PUMP = new Spec(PmEquipmentType.PUMP, "pm_sensor_pump", 3 * 86400L, 1800L, """
            INSERT INTO pm_sensor_pump (equip_id, recorded_at, vibration, pressure, temperature, current, flow, rpm)
            SELECT x.id, x.t,
                   980 + 2.0 * {N} - 850 * x.s,
                   1013 + 14 * {N} - 250 * x.s,
                   GREATEST(0, 2.505 + 0.015 * {N} - 0.6 * x.s),
                   GREATEST(0, 1.1 + 0.3 * {N} + 14 * x.s),
                   GREATEST(0, 36.2 + 1.8 * {N} - 4.5 * x.s),
                   GREATEST(0, 38 + 3 * {N} - 6 * x.s)
              FROM ({SEV}) x
            ON CONFLICT DO NOTHING
            """);

    private static final Spec CCTV = new Spec(PmEquipmentType.CCTV, "pm_sensor_cctv", 6 * 86400L, 5 * 3600L, """
            INSERT INTO pm_sensor_cctv (equip_id, recorded_at, video_receive_rate, response_time_ms, packet_loss_rate, image_blur_score)
            SELECT x.id, x.t,
                   LEAST(100, GREATEST(0, 99.0 + 0.65 * {N} - 7.5 * x.s)),
                   GREATEST(0, 48.7 + 5.8 * {N} + 47 * x.s),
                   GREATEST(0, 0.18 + 0.19 * {N} + 2.2 * x.s),
                   GREATEST(0, 6.6 + 3.5 * {N} + 31 * x.s)
              FROM ({SEV}) x
            ON CONFLICT DO NOTHING
            """);

    // 전광판: 주변 온도를 한 번만 뽑아야 본체 온도와 짝이 맞아서 안쪽 SELECT 를 한 겹 더 둔다 (OFFSET 0 = 합쳐지지 않게)
    private static final Spec DISPLAY = new Spec(PmEquipmentType.DISPLAY, "pm_sensor_display", 6 * 86400L, 8 * 3600L, """
            INSERT INTO pm_sensor_display (equip_id, recorded_at, temperature_c, ambient_c, ripple_v, response_time_ms, error_count, bad_pixel_pct)
            SELECT y.id, y.t,
                   y.a + 6.5 + 0.6 * {N} + CASE WHEN y.cause = 0 THEN 9 * y.s ELSE 0 END,
                   y.a,
                   GREATEST(0, 0.028 + 0.004 * {N} + CASE WHEN y.cause = 1 THEN 0.05 * y.s ELSE 0 END),
                   GREATEST(0, 43 + 5 * {N} + CASE WHEN y.cause = 2 THEN 60 * y.s ELSE 0 END),
                   CAST(CASE WHEN random() < 0.1 + CASE WHEN y.cause = 2 THEN 0.8 * y.s ELSE 0 END
                             THEN 1 + floor(random() * (1 + CASE WHEN y.cause = 2 THEN 8 * y.s ELSE 0 END)) ELSE 0 END AS integer),
                   GREATEST(0, 0.015 + 0.003 * {N} + CASE WHEN y.cause = 3 THEN 0.35 * y.s ELSE 0 END)
              FROM (SELECT x.id, x.t, x.s, (x.rk - 1) % 4 AS cause,
                           18 + 7 * sin(2 * pi() * (EXTRACT(HOUR FROM x.t) - 9) / 24) + 1.0 * {N} AS a
                      FROM ({SEV}) x OFFSET 0) y
            ON CONFLICT DO NOTHING
            """);

    private static final Spec WATER = new Spec(PmEquipmentType.WATER_LEVEL, "pm_sensor_water_level", 2 * 86400L, 3600L, """
            INSERT INTO pm_sensor_water_level (equip_id, recorded_at, level_m)
            SELECT x.id, x.t,
                   0.30 + 0.02 * sin(2 * pi() * (EXTRACT(HOUR FROM x.t) + EXTRACT(MINUTE FROM x.t) / 60.0 - 6) / 24)
                        + 0.004 * {N} * (1 + 10 * x.s) + 0.5 * x.s
              FROM ({SEV}) x
            ON CONFLICT DO NOTHING
            """);

    // 설비 × 시각 목록과 그 시각의 이상 정도 s(0~1). s 가 0 이면 정상 값, 1 이면 가장 심한 이상 값
    private static final String SEVERITY = """
            SELECT eq.id, eq.rk, g.t,
                   CASE eq.kind
                     WHEN 'D' THEN eq.amp * POWER(LEAST(1.0, GREATEST(0.0,
                                      EXTRACT(EPOCH FROM (g.t - CAST(:onset AS timestamp))) / CAST(:rampSec AS double precision))), 1.6)
                     WHEN 'S' THEN eq.amp * CASE WHEN g.t >= CAST(:spike0 AS timestamp)
                                                  AND g.t < CAST(:spike0 AS timestamp) + make_interval(secs => CAST(:spikeLen AS double precision))
                                                 THEN sin(pi() * EXTRACT(EPOCH FROM (g.t - CAST(:spike0 AS timestamp)))
                                                          / CAST(:spikeLen AS double precision))
                                                 ELSE 0 END
                     ELSE 0
                   END AS s
              FROM eq
             CROSS JOIN LATERAL generate_series(CAST(:startAt AS timestamp), CAST(:endAt AS timestamp),
                                                make_interval(secs => CAST(:stepSec AS double precision))) AS g(t)
            """;

    @PersistenceContext
    private EntityManager em;

    private final DbClock dbClock;
    private final int defaultWeeks;
    private final int defaultNormalWeeks;
    private final int pumpWeeks;

    public PmSensorBackfillServiceImpl(DbClock dbClock,
            @Value("${puf.pm.backfill.weeks:14}") int defaultWeeks,
            @Value("${puf.pm.backfill.normal-weeks:4}") int defaultNormalWeeks,
            @Value("${puf.pm.backfill.pump-weeks:0}") int pumpWeeks) {
        this.dbClock = dbClock;
        this.defaultWeeks = defaultWeeks;
        this.defaultNormalWeeks = defaultNormalWeeks;
        this.pumpWeeks = pumpWeeks;
    }

    @Override
    @Transactional
    public PmSensorBackfillResponse backfill(Integer weeksArg, Integer normalWeeksArg, LocalDateTime endAtArg, boolean reset,
            List<Long> equipIds) {
        int weeks = weeksArg == null ? defaultWeeks : weeksArg;
        int normalWeeks = normalWeeksArg == null ? defaultNormalWeeks : normalWeeksArg;
        if (weeks < 1 || weeks > 52) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "weeks는 1~52 사이여야 합니다.");
        }
        if (normalWeeks < 0 || normalWeeks > weeks) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "normalWeeks는 0 이상 weeks 이하여야 합니다.");
        }
        LocalDateTime endAt = (endAtArg == null ? dbClock.now() : endAtArg).truncatedTo(ChronoUnit.SECONDS);
        if (endAt.isAfter(dbClock.now())) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "endAt은 지금보다 이후일 수 없습니다.");
        }

        List<PmSensorBackfillResponse.TypeResult> results = new ArrayList<>();
        int skipped = 0;
        for (Spec spec : List.of(PUMP, CCTV, DISPLAY, WATER)) {
            long started = System.currentTimeMillis();
            int typeWeeks = spec == PUMP && pumpWeeks > 0 ? Math.min(weeks, pumpWeeks) : weeks;
            int typeNormal = Math.min(normalWeeks, typeWeeks);

            List<Long> targets = targets(spec, reset, equipIds);
            skipped += skippedCount(spec, reset, equipIds, targets);
            if (targets.isEmpty()) {
                results.add(new PmSensorBackfillResponse.TypeResult(spec.type(), 0, 0, null, 0));
                continue;
            }
            if (reset) {
                em.createNativeQuery("DELETE FROM " + spec.table() + " WHERE equip_id IN (:ids)").setParameter("ids", targets).executeUpdate();
                em.createNativeQuery("UPDATE pm_equipment SET data_started_at = NULL WHERE id IN (:ids)").setParameter("ids", targets).executeUpdate();
            }

            int step = intervalOf(spec);
            LocalDateTime end = alignDown(endAt, step);
            LocalDateTime start = alignDown(end.minusWeeks(typeWeeks), step);
            LocalDateTime normalEnd = start.plusWeeks(typeNormal);
            LocalDateTime onset = end.minusSeconds(spec.rampSec()).isBefore(normalEnd) ? normalEnd : end.minusSeconds(spec.rampSec());
            long rampSec = Math.max(1, Duration.between(onset, end).getSeconds());
            long anomalySec = Math.max(0, Duration.between(normalEnd, end).getSeconds());
            LocalDateTime spike0 = normalEnd.plusSeconds((long) (anomalySec * 0.35));

            String sql = spec.insertSql().replace("{SEV}", "WITH ranked AS (" + RANKED + "), eq AS (SELECT * FROM ranked WHERE id IN (:ids)) " + SEVERITY)
                    .replace("{N}", NOISE);
            long rows = em.createNativeQuery(sql)
                    .setParameter("type", spec.type().name())
                    .setParameter("ids", targets)
                    .setParameter("startAt", start).setParameter("endAt", end).setParameter("stepSec", step)
                    .setParameter("onset", onset).setParameter("rampSec", rampSec)
                    .setParameter("spike0", spike0).setParameter("spikeLen", spec.spikeLenSec())
                    .executeUpdate();

            em.createNativeQuery("UPDATE pm_equipment e SET data_started_at = (SELECT MIN(s.recorded_at) FROM " + spec.table()
                    + " s WHERE s.equip_id = e.id) WHERE e.id IN (:ids) AND (e.data_started_at IS NULL OR e.data_started_at > "
                    + "(SELECT MIN(s.recorded_at) FROM " + spec.table() + " s WHERE s.equip_id = e.id))")
                    .setParameter("ids", targets).executeUpdate();
            results.add(new PmSensorBackfillResponse.TypeResult(spec.type(), targets.size(), rows, start,
                    System.currentTimeMillis() - started));
        }
        return new PmSensorBackfillResponse(endAt, weeks, normalWeeks, reset, skipped, results);
    }

    // 종류별 번호(rk)는 지워지지 않은 같은 종류 전체에서 id 순으로 매긴다 (대상을 골라도 시나리오가 바뀌지 않게)
    private static final String RANKED = """
            SELECT r.id, r.rk,
                   CASE MOD(r.rk, 4) WHEN 1 THEN 'D' WHEN 2 THEN 'D' WHEN 0 THEN 'S' ELSE 'N' END AS kind,
                   CASE MOD(r.rk, 4) WHEN 1 THEN 1.0 WHEN 2 THEN {CAUTION} WHEN 0 THEN 1.0 ELSE 0.0 END AS amp
              FROM (SELECT e.id, row_number() OVER (ORDER BY e.id) AS rk
                      FROM pm_equipment e JOIN underpass u ON u.id = e.underpass_id AND u.is_deleted = FALSE
                     WHERE e.is_deleted = FALSE AND CAST(e.type AS text) = :type) r
            """.replace("{CAUTION}", String.valueOf(CAUTION_AMP));

    @SuppressWarnings("unchecked")
    private List<Long> targets(Spec spec, boolean reset, List<Long> equipIds) {
        String sql = "SELECT e.id FROM pm_equipment e JOIN underpass u ON u.id = e.underpass_id AND u.is_deleted = FALSE"
                + " WHERE e.is_deleted = FALSE AND CAST(e.type AS text) = :type"
                + (reset ? "" : " AND e.data_started_at IS NULL")
                + (equipIds == null || equipIds.isEmpty() ? "" : " AND e.id IN (:ids)") + " ORDER BY e.id";
        var q = em.createNativeQuery(sql).setParameter("type", spec.type().name());
        if (equipIds != null && !equipIds.isEmpty()) {
            q.setParameter("ids", equipIds);
        }
        List<Long> ids = new ArrayList<>();
        for (Object o : q.getResultList()) {
            ids.add(((Number) o).longValue());
        }
        return ids;
    }

    // reset 이 아닐 때 이미 센서 데이터가 있어서 건너뛴 설비 수
    private int skippedCount(Spec spec, boolean reset, List<Long> equipIds, List<Long> targets) {
        if (reset) {
            return 0;
        }
        String sql = "SELECT COUNT(*) FROM pm_equipment e JOIN underpass u ON u.id = e.underpass_id AND u.is_deleted = FALSE"
                + " WHERE e.is_deleted = FALSE AND CAST(e.type AS text) = :type"
                + (equipIds == null || equipIds.isEmpty() ? "" : " AND e.id IN (:ids)");
        var q = em.createNativeQuery(sql).setParameter("type", spec.type().name());
        if (equipIds != null && !equipIds.isEmpty()) {
            q.setParameter("ids", equipIds);
        }
        return ((Number) q.getSingleResult()).intValue() - targets.size();
    }

    private static int intervalOf(Spec spec) {
        return switch (spec.type()) {
            case PUMP -> 10;
            case WATER_LEVEL -> 300;
            default -> 3600;
        };
    }

    // 센서 주기(초)의 배수 시각으로 내림 (버킷 기준 2000-01-01 과 같은 규칙: 3600 이면 정각)
    private static LocalDateTime alignDown(LocalDateTime t, int stepSec) {
        long epoch = t.toEpochSecond(java.time.ZoneOffset.UTC);
        return LocalDateTime.ofEpochSecond(epoch - Math.floorMod(epoch, (long) stepSec), 0, java.time.ZoneOffset.UTC);
    }
}
