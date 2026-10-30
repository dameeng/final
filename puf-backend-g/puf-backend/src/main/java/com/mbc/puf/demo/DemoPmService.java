package com.mbc.puf.demo;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ThreadLocalRandom;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import com.mbc.puf.common.security.LoginUser;
import com.mbc.puf.pm.dto.PmScoreIngestItem;
import com.mbc.puf.pm.dto.PmScoreIngestRequest;
import com.mbc.puf.pm.service.PmIngestService;
import com.mbc.puf.pm.service.PmJudge;
import com.mbc.puf.pm.service.PmStubModeService;

/**
 * 시연용 예지보전 "위험으로 / 정상으로" 한 번에 (초량지하차도 설비만). puf.demo.enabled=true 일 때만 존재한다.
 *
 * 센서값을 위험하게 넣어도 모델의 계산 주기·윈도우 때문에 점수가 바로 오르지 않는다. 그래서
 *  1) 누르는 즉시 점수를 정상 수신 경로(PmIngestService.receiveScores)로 넣어 위험진입 이벤트·긴급 알림·SSE 가 원래 로직대로 나가게 하고,
 *  2) 센서 stub 도 같이 위험으로 바꿔(기존 pm_stub_mode) 센서 데이터는 계속 쌓이게 하며,
 *  3) 고정(pin)된 동안 예지보전 서버가 보내는 실제 점수는 받지 않고 10초마다 같은 단계의 점수를 새 시각으로 넣는다.
 * 고정 풀기: 위험 고정은 실제 모델 점수가 위험 임계치에 닿으면(= 모델이 따라잡음), 정상 고정은 실제 점수가 주의 미만이 되면 자동으로 풀린다.
 * 그 전에 누가 센서 stub 을 반대 모드로 바꾸거나(개별 버튼·점검 조치완료) 이 API 로 반대 버튼을 누르면 즉시 풀린다.
 * 기존 점수 행을 지우거나 덮어쓰지 않는다 (새 시각의 점수 행이 추가될 뿐).
 */
@Service
@ConditionalOnProperty(name = "puf.demo.enabled", havingValue = "true")
public class DemoPmService {

    private static final Logger log = LoggerFactory.getLogger(DemoPmService.class);
    private static final String UNDERPASS_NAME = "초량지하차도";
    private static final String MODEL_VERSION = "demo-pin";

    private record Pin(String mode, LocalDateTime since) {}

    private final JdbcTemplate jdbc;
    private final PmIngestService ingest;
    private final PmStubModeService stubMode;
    private final Map<Long, Pin> pins = new ConcurrentHashMap<>();

    public DemoPmService(JdbcTemplate jdbc, PmIngestService ingest, PmStubModeService stubMode) {
        this.jdbc = jdbc;
        this.ingest = ingest;
        this.stubMode = stubMode;
    }

    /** 초량지하차도의 노면(ROAD) 제외 설비 */
    private List<Map<String, Object>> targets() {
        return jdbc.queryForList(
                "SELECT e.id, e.type::text AS type, e.name FROM pm_equipment e JOIN underpass u ON u.id = e.underpass_id "
                        + "WHERE u.name = ? AND NOT u.is_deleted AND NOT e.is_deleted AND e.type::text <> 'ROAD' ORDER BY e.id",
                UNDERPASS_NAME);
    }

    /** 초량 설비 전체를 위험(DANGER) 또는 정상(NORMAL)으로 고정하고 바로 점수를 넣는다 */
    public List<Map<String, Object>> setAll(LoginUser user, String mode) {
        List<Map<String, Object>> eq = targets();
        List<PmScoreIngestItem> items = new ArrayList<>();
        LocalDateTime now = LocalDateTime.now().truncatedTo(ChronoUnit.SECONDS);
        for (Map<String, Object> e : eq) {
            long id = ((Number) e.get("id")).longValue();
            String type = String.valueOf(e.get("type"));
            try {
                stubMode.change(user, id, mode);            // 센서 stub 도 같이 (권한·지역 검사 포함)
            } catch (RuntimeException ex) {
                log.warn("[DemoPm] 센서 stub 모드 변경 실패 equip={} : {}", id, ex.getMessage());
            }
            pins.put(id, new Pin(mode, now));
            items.add(item(id, type, mode, now));
        }
        send(items);
        return list();
    }

    /** 고정 풀기 (점수는 그대로 두고 예지보전 서버 점수가 다시 이어받는다) */
    public List<Map<String, Object>> release() {
        pins.clear();
        return list();
    }

    public List<Map<String, Object>> list() {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> e : targets()) {
            long id = ((Number) e.get("id")).longValue();
            Pin p = pins.get(id);
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("equipId", id);
            m.put("name", e.get("name"));
            m.put("type", e.get("type"));
            m.put("pinned", p == null ? null : p.mode());
            List<Map<String, Object>> s = jdbc.queryForList(
                    "SELECT score FROM pm_score WHERE equip_id = ? ORDER BY predicted_at DESC LIMIT 1", id);
            m.put("latestScore", s.isEmpty() ? null : s.get(0).get("score"));
            out.add(m);
        }
        return out;
    }

    /**
     * 예지보전 서버가 보낸 점수 묶음에서 고정된 설비의 실제 점수를 걸러낸다. 모델이 따라잡았으면(고정 방향 그대로) 고정을 풀고 통과시킨다.
     * backfill 묶음은 건드리지 않는다.
     */
    public PmScoreIngestRequest filter(PmScoreIngestRequest req) {
        if (pins.isEmpty() || req == null || req.isBackfill() || req.getScores() == null) {
            return req;
        }
        List<PmScoreIngestItem> keep = new ArrayList<>();
        for (PmScoreIngestItem it : req.getScores()) {
            Pin p = it.getEquipId() == null ? null : pins.get(it.getEquipId());
            if (p == null) {
                keep.add(it);
                continue;
            }
            BigDecimal score = it.getScore();
            boolean caughtUp = score != null && ("DANGER".equals(p.mode())
                    ? score.compareTo(dangerMin(it.getEquipId())) >= 0
                    : score.compareTo(PmJudge.DEFAULT_CAUTION) < 0);
            if (caughtUp) {
                pins.remove(it.getEquipId());
                keep.add(it);
                log.info("[DemoPm] equip={} 모델 점수 {} 가 따라와 고정 해제", it.getEquipId(), score);
            }
        }
        PmScoreIngestRequest out = new PmScoreIngestRequest();
        out.setBackfill(req.isBackfill());
        out.setScores(keep);
        return out;
    }

    /** 10초마다 고정 설비에 새 시각의 점수를 넣는다 (최신 점수가 고정 단계로 유지되게) */
    @Scheduled(fixedDelay = 10_000, initialDelay = 15_000)
    public void tick() {
        if (pins.isEmpty()) {
            return;
        }
        try {
            LocalDateTime now = LocalDateTime.now().truncatedTo(ChronoUnit.SECONDS);
            List<PmScoreIngestItem> items = new ArrayList<>();
            for (Map<String, Object> e : targets()) {
                long id = ((Number) e.get("id")).longValue();
                Pin p = pins.get(id);
                if (p == null) {
                    continue;
                }
                // 누군가 센서 stub 을 반대로 바꿨으면(개별 버튼·조치완료) 고정을 푼다
                List<String> cur = jdbc.queryForList("SELECT mode FROM pm_stub_mode WHERE equip_id = ?", String.class, id);
                String curMode = cur.isEmpty() ? "NORMAL" : cur.get(0);
                if (!curMode.equals(p.mode())) {
                    pins.remove(id);
                    log.info("[DemoPm] equip={} 센서 stub 이 {} 로 바뀌어 고정 해제", id, curMode);
                    continue;
                }
                items.add(item(id, String.valueOf(e.get("type")), p.mode(), now));
            }
            send(items);
        } catch (RuntimeException ex) {
            log.warn("[DemoPm] 점수 재주입 실패: {}", ex.getMessage());
        }
    }

    private void send(List<PmScoreIngestItem> items) {
        if (items.isEmpty()) {
            return;
        }
        PmScoreIngestRequest req = new PmScoreIngestRequest();
        req.setBackfill(false);
        req.setScores(items);
        ingest.receiveScores(req);
    }

    private BigDecimal dangerMin(Long equipId) {
        List<BigDecimal> r = jdbc.queryForList(
                "SELECT min_score FROM pm_threshold WHERE equip_id = ? AND level::text = '위험'", BigDecimal.class, equipId);
        return r.isEmpty() ? PmJudge.DEFAULT_DANGER : r.get(0);
    }

    private PmScoreIngestItem item(long equipId, String type, String mode, LocalDateTime at) {
        ThreadLocalRandom rnd = ThreadLocalRandom.current();
        boolean danger = "DANGER".equals(mode);
        PmScoreIngestItem it = new PmScoreIngestItem();
        it.setEquipId(equipId);
        it.setType(type);
        it.setPredictedAt(at);
        it.setModelVersion(MODEL_VERSION);
        it.setScore(BigDecimal.valueOf(danger ? 88 + rnd.nextInt(0, 80) / 10.0 : 6 + rnd.nextInt(0, 60) / 10.0)
                .setScale(2, java.math.RoundingMode.HALF_UP));
        it.setReasons(danger ? dangerReasons(type) : List.of("평소와 비슷한 정상 범위예요"));
        return it;
    }

    private static List<String> dangerReasons(String type) {
        return switch (type) {
            case "PUMP" -> List.of("진동이 평소보다 매우 크게 올랐어요", "토출 압력과 유량이 평소보다 많이 떨어졌어요", "모터 전류가 평소보다 높아요");
            case "CCTV" -> List.of("영상 수신률이 평소보다 매우 많이 낮아요", "응답 지연과 패킷 손실이 크게 늘었어요");
            case "DISPLAY" -> List.of("내부 온도가 평소보다 매우 높아요", "통신 오류가 자주 발생해요", "화면 표시 이상이 감지됐어요");
            case "WATER_LEVEL" -> List.of("수위 값이 짧은 시간에 비정상적으로 튀었어요", "수위계 응답이 불안정해요");
            default -> List.of("센서 값이 평소 범위를 크게 벗어났어요");
        };
    }
}
