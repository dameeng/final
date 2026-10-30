package com.mbc.puf.pm.service;

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
 * 센서 데이터 생성기 (과거 백필 + 실시간 stub + 모드 전환 즉시 생성). 값은 DB 안에서 SQL 로 한 번에 만든다.
 *
 * [원칙] 평소(정상)에는 센서값이 평소 범위 안에서만 움직이고, 예지보전 점수(건강 점수)도 거의 일정하다.
 *        이상은 "DANGER 모드"를 켠 설비에만, 켠 시점부터 들어간다. 과거 백필에는 이상을 넣지 않는다.
 *        (예전에는 설비 번호별로 위험·주의·튐 시나리오를 미리 심어서, 평소에도 점수가 계속 요동쳤다)
 *
 * [정상값] 센서 하나의 값 = 평소 중심값 + 천천히 움직이는 성분(부하·열·날씨, 시각으로 정해지는 값) + 작은 측정 잡음.
 *   - 천천히 움직이는 성분은 (설비, 센서, 시각)만으로 정해지는 값이라 백필과 실시간이 끊김 없이 이어지고, 서버를 껐다 켜도 같은 곡선이다.
 *   - 같은 설비의 센서들은 같은 "부하" 성분을 함께 따라간다 (펌프: 회전수·유량·전류가 같이 오르내리고, 압력은 반대로, 진동은 조금).
 *   - 전류·전압(리플)처럼 운전 조건이 정하는 값은 변동 폭을 아주 작게, 진동·온도는 상대적으로 크게 둔다.
 *   중심값은 예지보전 모델이 학습한 평소 값(baseline)에 맞췄다:
 *   펌프  진동 980 / 압력 1005 / 온도 2.505 / 전류 1.1 / 유량 36.3 / 회전수 38.3
 *   CCTV  수신률 99.1% / 응답 48.7ms(저녁에 조금 느려짐) / 손실 0.165% / 흐림 6.5(밤에 조금 높음)
 *   전광판 본체-외기 6.5℃ (외기는 하루 주기 + 날씨 변화) / 리플 0.028V / 응답 43ms / 오류 시간당 약 0.08건 / 불량화소 0.015%
 *   수위계 0.30m 기준 하루 주기 ±0.02 + 잡음
 *
 * [이상(DANGER)] 설비 종류별 대표 고장. 이상 정도 s(0~1)는 DANGER 를 켠 시각부터 커진다 (s=1 이 완전한 고장 상태).
 *   펌프   정전 — 전류·회전수·유량이 0 으로 떨어지고(30초에 걸쳐 멈춤), 압력·진동·온도가 따라 떨어진다
 *   CCTV   통신 불량 — 수신률 급락, 응답 시간·패킷 손실 급증, 화면 흐림 증가
 *   전광판 설비 번호 순서대로 4가지 원인 — 과열 / 전원 불안(리플) / 통신(응답·오류) / 화면(불량 화소)
 *   수위계 값이 갑자기 튀고 흔들림이 커짐
 *
 * 주의: 펌프 모델은 전류·유량·회전수를 단독으로 보지 못한다(진동·압력·온도 중심이고 나머지는 "평소 범위를 벗어난 센서 비율"로만 반영).
 *       그래서 정전 때 점수가 오르는 폭은 모델을 다시 학습해야 커진다. 이 클래스는 센서값만 만든다.
 */
@Service
public class PmSensorBackfillServiceImpl implements PmSensorBackfillService {

    // 측정 잡음(평균 0, 표준편차 약 1). 행마다 새로 뽑는다.
    private static final String WHITE = "((random() + random() + random() - 1.5) * 2)";

    /** 설비 종류별 만드는 방법. faultRampSec = DANGER 를 켠 뒤 완전한 고장(s=1)이 될 때까지 걸리는 시간(초, 0 이면 바로) */
    private record Spec(PmEquipmentType type, String table, long faultRampSec, String insertSql) {
    }

    /**
     * 시각으로 정해지는, 천천히 움직이는 값 (대략 -1 ~ 1, 표준편차 약 1).
     * periodSec 마다 설비·센서별 고정 난수(해시)를 하나 뽑고 사이를 부드럽게 이어 붙인다. 안쪽 SELECT 의 별칭은 b 여야 한다.
     */
    private static String slow(String salt, long periodSec) {
        // numeric 이 아니라 double precision 으로 계산해야 빠르다 (펌프는 행이 수십만 개)
        String epoch = "b.ep";
        String k = "floor(" + epoch + " / " + periodSec + ")";
        String f = "(" + epoch + " / " + periodSec + " - " + k + ")";
        String w = "(" + f + " * " + f + " * (3 - 2 * " + f + "))";
        int saltNo = (salt.hashCode() & 0xffff) + 1;
        return "(2.2 * ((1 - " + w + ") * " + hash(saltNo, k, 0) + " + " + w + " * " + hash(saltNo, k, 1) + "))";
    }

    // (설비, 센서, 구간 번호)마다 고정된 -1 ~ 1 값
    private static String hash(int saltNo, String k, int plus) {
        return "(CAST(hashint8(b.id * 1000003 + CAST(" + k + " + " + plus + " AS bigint) * 7919 + " + saltNo
                + ") % 2001 AS double precision) / 2000)";
    }

    // 하루 주기 값(-1 ~ 1). phaseHour 시각에 0 을 지나 올라간다
    private static String daily(String t, double phaseHour) {
        return "sin(2 * pi() * (EXTRACT(HOUR FROM " + t + ") + EXTRACT(MINUTE FROM " + t + ") / 60.0 - " + phaseHour + ") / 24)";
    }

    private static final String SLOW_COLS_PUMP = ", " + slow("ld", 1200) + " AS ld, " + slow("th", 10800) + " AS th";
    private static final String SLOW_COLS_CCTV = ", " + slow("ld", 21600) + " AS ld";
    private static final String SLOW_COLS_DISPLAY = ", " + slow("ld", 21600) + " AS ld, " + slow("wm", 28800) + " AS wm";

    // 배수펌프: 부하(ld)가 회전수·유량·전류를 같이 움직이고 압력은 반대로(펌프 곡선). s=1 이면 정전.
    private static final Spec PUMP = new Spec(PmEquipmentType.PUMP, "pm_sensor_pump", 30, """
            INSERT INTO pm_sensor_pump (equip_id, recorded_at, vibration, pressure, temperature, current, flow, rpm)
            SELECT x.id, x.t,
                   GREATEST(0, 980 + 0.9 * x.ld + 1.7 * {W} - 850 * x.s),
                   GREATEST(0, 1005 - 4 * x.ld + 8.5 * {W} - 250 * x.s),
                   GREATEST(0, 2.505 + 0.006 * x.th + 0.004 * x.ld + 0.004 * {W} - 0.6 * x.s),
                   GREATEST(0, (1.10 + 0.04 * x.ld + 0.015 * {W}) * (1 - x.s)),
                   GREATEST(0, (36.3 + 0.8 * x.ld + 0.5 * {W}) * (1 - x.s)),
                   GREATEST(0, (38.3 + 0.7 * x.ld + 0.3 * {W}) * (1 - x.s))
              FROM (SELECT b.id, b.rk, b.t, b.s""" + SLOW_COLS_PUMP + """

                      FROM ({SEV}) b OFFSET 0) x
            ON CONFLICT DO NOTHING
            """);

    private static final Spec CCTV = new Spec(PmEquipmentType.CCTV, "pm_sensor_cctv", 0, """
            INSERT INTO pm_sensor_cctv (equip_id, recorded_at, video_receive_rate, response_time_ms, packet_loss_rate, image_blur_score)
            SELECT x.id, x.t,
                   LEAST(100, GREATEST(0, 99.1 + 0.12 * x.ld + 0.1 * {W} - 55 * x.s)),
                   GREATEST(0, 48.7 + 1.0 * """ + daily("x.t", 14) + """
 + 0.8 * x.ld + 1.0 * {W} + 350 * x.s),
                   GREATEST(0, 0.165 + 0.015 * x.ld + 0.025 * {W} + 12 * x.s),
                   GREATEST(0, 6.5 - 0.5 * """ + daily("x.t", 14) + """
 + 0.3 * x.ld + 0.4 * {W} + 20 * x.s)
              FROM (SELECT b.id, b.rk, b.t, b.s""" + SLOW_COLS_CCTV + """

                      FROM ({SEV}) b OFFSET 0) x
            ON CONFLICT DO NOTHING
            """);

    // 전광판: 외기 온도를 한 번만 뽑아야 본체 온도와 짝이 맞아서 안쪽 SELECT 를 한 겹 더 둔다 (OFFSET 0 = 합쳐지지 않게)
    // 이상 원인은 설비 번호(rk) 순서대로 0 과열 / 1 전원 / 2 통신 / 3 화면
    private static final Spec DISPLAY = new Spec(PmEquipmentType.DISPLAY, "pm_sensor_display", 0, """
            INSERT INTO pm_sensor_display (equip_id, recorded_at, temperature_c, ambient_c, ripple_v, response_time_ms, error_count, bad_pixel_pct)
            SELECT y.id, y.t,
                   y.a + 6.5 + 0.15 * y.ld + 0.25 * {W} + CASE WHEN y.cause = 0 THEN 14 * y.s ELSE 0 END,
                   y.a,
                   GREATEST(0, 0.028 + 0.0015 * y.ld + 0.0015 * {W} + CASE WHEN y.cause = 1 THEN 0.12 * y.s ELSE 0 END),
                   GREATEST(0, 43 + 1.5 * """ + daily("y.t", 14) + """
 + 2 * {W} + CASE WHEN y.cause = 2 THEN 300 * y.s ELSE 0 END),
                   CAST(CASE WHEN random() < 0.08 + CASE WHEN y.cause = 2 THEN 0.8 * y.s ELSE 0 END
                             THEN 1 + floor(random() * (1 + CASE WHEN y.cause = 2 THEN 8 * y.s ELSE 0 END)) ELSE 0 END AS integer),
                   GREATEST(0, 0.015 + 0.001 * {W} + CASE WHEN y.cause = 3 THEN 1.2 * y.s ELSE 0 END)
              FROM (SELECT x.id, x.t, x.s, x.ld, (x.rk - 1) % 4 AS cause,
                           18 + 7 * """ + daily("x.t", 9) + """
 + 1.2 * x.wm + 0.4 * {W} AS a
                      FROM (SELECT b.id, b.rk, b.t, b.s""" + SLOW_COLS_DISPLAY + """

                              FROM ({SEV}) b OFFSET 0) x OFFSET 0) y
            ON CONFLICT DO NOTHING
            """);

    private static final Spec WATER = new Spec(PmEquipmentType.WATER_LEVEL, "pm_sensor_water_level", 0, """
            INSERT INTO pm_sensor_water_level (equip_id, recorded_at, level_m)
            SELECT x.id, x.t,
                   0.30 + 0.02 * """ + daily("x.t", 6) + """
 + 0.004 * {W} * (1 + 8 * x.s) + 0.4 * x.s
              FROM ({SEV}) x
            ON CONFLICT DO NOTHING
            """);

    /** 설비 × 시각 목록(inner)에 초 단위 시각(ep)을 한 번만 계산해 붙인다. OFFSET 0 = 합쳐지지 않게(그래야 컬럼마다 다시 계산하지 않는다) */
    private static String withEpoch(String inner) {
        return "SELECT s0.id, s0.rk, s0.t, s0.s, CAST(EXTRACT(EPOCH FROM s0.t) AS double precision) AS ep FROM (" + inner + ") s0 OFFSET 0";
    }

    // 설비 × 시각 목록 (과거 백필용). 이상 정도 s 는 항상 0 = 정상 값만 만든다
    private static final String SEVERITY = """
            SELECT eq.id, eq.rk, g.t, CAST(0 AS double precision) AS s
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

    /**
     * 과거 백필. 이제 이상 구간이 없어서 normalWeeks 는 값 검사와 응답 표시에만 쓰이고, 만드는 데이터에는 영향이 없다
     * (기존 API 모양을 바꾸지 않으려고 남겨 두었다).
     */
    @Override
    @Transactional
    public PmSensorBackfillResponse backfill(Integer weeksArg, Integer normalWeeksArg, LocalDateTime endAtArg, boolean reset,
            List<Long> equipIds) {
        int weeks = weeksArg == null ? defaultWeeks : weeksArg;
        int normalWeeks = normalWeeksArg == null ? (weeksArg == null ? weeks : Math.min(defaultNormalWeeks,weeks)) : normalWeeksArg;
        if (weeks < 1 || weeks > 52) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "weeks는 1~52 사이여야 합니다.");
        }
        if (normalWeeks < 0 || normalWeeks > weeks) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "normalWeeks는 0 이상 weeks 이하여야 합니다.");
        }
        // 센서 스텁 및 다른 백필과 같은 트랜잭션 잠금으로 중복 대량 생성을 막는다.
        em.createNativeQuery("SELECT TRUE FROM pg_advisory_xact_lock(731905210)").getSingleResult();
        LocalDateTime endAt = (endAtArg == null ? dbClock.now() : endAtArg).truncatedTo(ChronoUnit.SECONDS);
        if (endAt.isAfter(dbClock.now())) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "endAt은 지금보다 이후일 수 없습니다.");
        }

        List<PmSensorBackfillResponse.TypeResult> results = new ArrayList<>();
        int skipped = 0;
        for (Spec spec : List.of(PUMP, CCTV, DISPLAY, WATER)) {
            long started = System.currentTimeMillis();
            // 과거 버전에서 메타데이터만 빠졌어도 실제 센서가 있으면 다시 생성하지 않는다.
            em.createNativeQuery("UPDATE pm_equipment e SET data_started_at = (SELECT MIN(s.recorded_at) FROM "
                    + spec.table() + " s WHERE s.equip_id = e.id)"
                    + " WHERE e.data_started_at IS NULL AND e.is_deleted = FALSE AND CAST(e.type AS text) = :type"
                    + " AND EXISTS (SELECT 1 FROM " + spec.table() + " s WHERE s.equip_id = e.id)")
                    .setParameter("type", spec.type().name()).executeUpdate();
            int typeWeeks = spec == PUMP && pumpWeeks > 0 ? Math.min(weeks, pumpWeeks) : weeks;

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

            String sql = spec.insertSql().replace("{SEV}", withEpoch("WITH ranked AS (" + RANKED + "), eq AS (SELECT * FROM ranked WHERE id IN (:ids)) " + SEVERITY))
                    .replace("{W}", WHITE);
            long rows = em.createNativeQuery(sql)
                    .setParameter("type", spec.type().name())
                    .setParameter("ids", targets)
                    .setParameter("startAt", start).setParameter("endAt", end).setParameter("stepSec", step)
                    .executeUpdate();

            em.createNativeQuery("UPDATE pm_equipment e SET data_started_at = (SELECT MIN(s.recorded_at) FROM " + spec.table()
                    + " s WHERE s.equip_id = e.id) WHERE e.id IN (:ids)")
                    .setParameter("ids", targets).executeUpdate();
            results.add(new PmSensorBackfillResponse.TypeResult(spec.type(), targets.size(), rows, start,
                    System.currentTimeMillis() - started));
        }
        return new PmSensorBackfillResponse(endAt, weeks, normalWeeks, reset, skipped, results);
    }

    // 종류별 번호(rk)는 지워지지 않은 같은 종류 전체에서 id 순으로 매긴다 (대상을 골라도 원인 배정이 바뀌지 않게)
    /**
     * 실시간 시연 센서. 과거 백필과 같은 정상값 식을 쓴다 (백필과 값의 범위·움직임이 같아서 구간이 바뀌어도 티가 나지 않는다).
     * DB 시계, 장비의 sensor_interval_sec, 조회 API와 같은 2000년 버킷 기준을 사용한다.
     * DANGER 모드(pm_stub_mode)인 설비만 켠 시각부터 이상값이 들어가고, 나머지는 전부 정상이다.
     * 중단 중 생긴 공백은 최근 maxSamples개만 채운다 (장기 이력은 기존 backfill API 담당).
     */
    @Override
    @Transactional
    public int appendRecent(int maxSamples) {
        if (maxSamples < 1 || maxSamples > 360) {
            throw new IllegalArgumentException("maxSamples must be between 1 and 360");
        }
        // 여러 인스턴스가 동시에 떠도 생성 쿼리는 한 인스턴스만 실행한다.
        if (!Boolean.TRUE.equals(em.createNativeQuery("SELECT pg_try_advisory_xact_lock(731905210)").getSingleResult())) {
            return 0;
        }
        LocalDateTime now = dbClock.now();
        int total = 0;
        for (Spec spec : List.of(PUMP, CCTV, DISPLAY, WATER)) {
            String times = """
                    WITH ranked AS (
                        SELECT e.id, e.sensor_interval_sec AS step,
                               row_number() OVER (ORDER BY e.id) AS rk
                          FROM pm_equipment e
                          JOIN underpass u ON u.id = e.underpass_id AND u.is_deleted = FALSE
                         WHERE e.is_deleted = FALSE AND CAST(e.type AS text) = :type
                    ), eq AS (
                        SELECT r.*,
                               date_bin(make_interval(secs => r.step), CAST(:now AS timestamp),
                                        TIMESTAMP '2000-01-01 00:00:00') AS until_at,
                               (SELECT MAX(s.recorded_at) FROM {TABLE} s WHERE s.equip_id = r.id) AS last_at
                          FROM ranked r
                    )
                    SELECT e.id, e.rk, g.t,
                           CAST(COALESCE((SELECT CASE WHEN m.mode = 'DANGER' AND g.t >= m.changed_at
                                                      THEN CASE WHEN CAST(:rampSec AS double precision) <= 0 THEN 1.0
                                                                ELSE LEAST(1.0, (EXTRACT(EPOCH FROM (g.t - m.changed_at)) + CAST(:rampSec AS double precision) / 3)
                                                                                / CAST(:rampSec AS double precision)) END
                                                      ELSE 0.0 END
                                            FROM pm_stub_mode m WHERE m.equip_id = e.id), 0.0) AS double precision) AS s
                      FROM eq e
                     CROSS JOIN LATERAL generate_series(
                         GREATEST(COALESCE(
                             date_bin(make_interval(secs => e.step), e.last_at, TIMESTAMP '2000-01-01')
                                 + make_interval(secs => e.step), e.until_at),
                             e.until_at - make_interval(secs => e.step * (:maxSamples - 1))),
                         e.until_at, make_interval(secs => e.step)) AS g(t)
                    """.replace("{TABLE}", spec.table());
            String sql = spec.insertSql().replace("{SEV}", withEpoch(times)).replace("{W}", WHITE);
            int added = em.createNativeQuery(sql)
                    .setParameter("type", spec.type().name()).setParameter("now", now)
                    .setParameter("rampSec", spec.faultRampSec())
                    .setParameter("maxSamples", maxSamples).executeUpdate();
            total += added;
            // 새 설비 또는 기존 메타데이터가 비어 있는 설비의 시작 시각을 기록한다.
            if (added > 0) {
                em.createNativeQuery("UPDATE pm_equipment e SET data_started_at = (SELECT MIN(s.recorded_at) FROM "
                        + spec.table() + " s WHERE s.equip_id = e.id)"
                        + " WHERE e.data_started_at IS NULL AND CAST(e.type AS text) = :type"
                        + " AND e.is_deleted = FALSE AND EXISTS (SELECT 1 FROM " + spec.table()
                        + " s WHERE s.equip_id = e.id)")
                        .setParameter("type", spec.type().name()).executeUpdate();
            }
        }
        return total;
    }

    // 종류별 번호(rk)와 대상 설비 (과거 백필용: 이상 없이 정상값만)
    private static final String RANKED = """
            SELECT r.id, r.rk
              FROM (SELECT e.id, row_number() OVER (ORDER BY e.id) AS rk
                      FROM pm_equipment e JOIN underpass u ON u.id = e.underpass_id AND u.is_deleted = FALSE
                     WHERE e.is_deleted = FALSE AND CAST(e.type AS text) = :type) r
            """;

    @SuppressWarnings("unchecked")
    private List<Long> targets(Spec spec, boolean reset, List<Long> equipIds) {
        String sql = "SELECT e.id FROM pm_equipment e JOIN underpass u ON u.id = e.underpass_id AND u.is_deleted = FALSE"
                + " WHERE e.is_deleted = FALSE AND CAST(e.type AS text) = :type"
                + (reset ? "" : " AND NOT EXISTS (SELECT 1 FROM " + spec.table() + " s WHERE s.equip_id = e.id)")
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

    /**
     * 모드 전환 시 주기를 기다리지 않고 대상 한 대의 새 센서값을 추가한다.
     * danger=true 면 이상이 막 시작된 상태의 값(바로 완전한 고장이 되는 종류는 s=1, 서서히 멈추는 펌프는 s=1/3 (이어지는 실시간 값도 1/3 에서 시작해 s=1 까지 오른다)), false 면 정상값.
     */
    @Transactional
    public int emitNow(long equipId, String type, boolean danger) {
        em.createNativeQuery("SELECT TRUE FROM pg_advisory_xact_lock(731905210)").getSingleResult();
        Spec spec = List.of(PUMP,CCTV,DISPLAY,WATER).stream().filter(v->v.type().name().equals(type))
                .findFirst().orElseThrow(()->new IllegalArgumentException("Unsupported sensor type"));
        String times = "SELECT e.id, (SELECT COUNT(*) FROM pm_equipment p WHERE p.type=e.type AND NOT p.is_deleted AND p.id<=e.id) AS rk, "
                + "GREATEST(CAST(:now AS timestamp), COALESCE((SELECT MAX(recorded_at)+interval '1 microsecond' FROM "
                +spec.table()+" WHERE equip_id=e.id),CAST(:now AS timestamp))) AS t, CAST(:severity AS double precision) AS s "
                +"FROM pm_equipment e WHERE e.id=:equipId AND NOT e.is_deleted";
        double severity = !danger ? 0.0 : spec.faultRampSec() > 0 ? 1.0 / 3 : 1.0;
        return em.createNativeQuery(spec.insertSql().replace("{SEV}",withEpoch(times)).replace("{W}",WHITE))
                .setParameter("now",dbClock.now()).setParameter("severity",severity)
                .setParameter("equipId",equipId).executeUpdate();
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
