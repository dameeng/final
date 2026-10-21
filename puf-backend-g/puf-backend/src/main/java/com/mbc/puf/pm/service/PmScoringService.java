package com.mbc.puf.pm.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mbc.puf.common.enums.ManagerNotificationCategory;
import com.mbc.puf.common.exception.BusinessException;
import com.mbc.puf.common.jpa.DbClock;
import com.mbc.puf.common.jpa.NativeSql;
import com.mbc.puf.notification.service.NotificationService;
import com.mbc.puf.pm.dto.PmSensorIngestRequest;
import com.mbc.puf.pm.dto.PmSensorIngestResponse;
import com.mbc.puf.pm.entity.PmEquipment;
import com.mbc.puf.pm.entity.PmEquipmentType;
import com.mbc.puf.pm.entity.PmEvent;
import com.mbc.puf.pm.entity.PmEventStatus;
import com.mbc.puf.pm.entity.PmLevel;
import com.mbc.puf.pm.entity.PmScore;
import com.mbc.puf.pm.entity.PmSensor;
import com.mbc.puf.pm.entity.PmThreshold;
import com.mbc.puf.pm.repository.PmEquipmentRepository;
import com.mbc.puf.pm.repository.PmEventRepository;
import com.mbc.puf.pm.repository.PmScoreRepository;
import com.mbc.puf.pm.repository.PmSensorRepository;
import com.mbc.puf.pm.repository.PmThresholdRepository;
import com.mbc.puf.stream.StreamPublisher;
import com.mbc.puf.underpass.entity.Underpass;
import com.mbc.puf.underpass.repository.UnderpassRepository;

import jakarta.persistence.EntityManager;

/**
 * 예지보전 점수 계산 + 점검 대상(pm_event) 만들기.
 *
 *  1) pm_sensor 에 들어온 측정값 중 아직 점수가 없는 것을 (설비, 측정 시각) 묶음으로 모아 PmRules 로 점수 계산 → pm_score
 *  2) 설비별 가장 최근 점수가 그 설비 기준(pm_threshold)으로 주의 이상이면
 *     - 열린 점검 대상이 없으면 새로 만들고 관리자 알림(설비) 발송
 *     - 이미 있는데 단계가 올라갔으면(주의 → 위험) 단계·점수·사유를 올리고 다시 알림
 *  점수가 내려가도 점검 대상은 자동으로 닫지 않는다 (관리자가 조치 등록으로 닫는다).
 */
@Service
public class PmScoringService {

    private static final List<PmEventStatus> OPEN = List.of(PmEventStatus.CHECK_NEEDED, PmEventStatus.IN_PROGRESS);

    private final EntityManager em;
    private final PmEquipmentRepository equipmentRepository;
    private final PmSensorRepository sensorRepository;
    private final PmScoreRepository scoreRepository;
    private final PmThresholdRepository thresholdRepository;
    private final PmEventRepository eventRepository;
    private final UnderpassRepository underpassRepository;
    private final NotificationService notificationService;
    private final StreamPublisher streamPublisher;
    private final DbClock dbClock;

    public PmScoringService(EntityManager em, PmEquipmentRepository equipmentRepository,
                            PmSensorRepository sensorRepository, PmScoreRepository scoreRepository,
                            PmThresholdRepository thresholdRepository, PmEventRepository eventRepository,
                            UnderpassRepository underpassRepository, NotificationService notificationService,
                            StreamPublisher streamPublisher, DbClock dbClock) {
        this.em = em;
        this.equipmentRepository = equipmentRepository;
        this.sensorRepository = sensorRepository;
        this.scoreRepository = scoreRepository;
        this.thresholdRepository = thresholdRepository;
        this.eventRepository = eventRepository;
        this.underpassRepository = underpassRepository;
        this.notificationService = notificationService;
        this.streamPublisher = streamPublisher;
        this.dbClock = dbClock;
    }

    /** 측정값 넣기 (내부 API). 넣자마자 점수까지 계산해서 돌려준다 */
    @Transactional
    public PmSensorIngestResponse ingest(PmSensorIngestRequest request) {
        PmEquipment equipment = equipmentRepository.findById(request.equipId())
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "존재하지 않는 설비입니다. id=" + request.equipId()));
        LocalDateTime at = request.recordedAt() != null ? request.recordedAt() : dbClock.now();
        List<PmSensor> rows = new ArrayList<>();
        for (Map.Entry<String, BigDecimal> e : request.values().entrySet()) {
            if (PmRules.find(equipment.getType(), e.getKey()) == null) {
                throw new BusinessException(HttpStatus.BAD_REQUEST, equipment.getType().getLabel()
                        + " 설비에 없는 측정 항목입니다: " + e.getKey() + " (GET /api/pm/rules 참고)");
            }
            if (e.getValue() == null) {
                throw new BusinessException(HttpStatus.BAD_REQUEST, "측정값이 비어 있습니다: " + e.getKey());
            }
            rows.add(new PmSensor(equipment.getId(), e.getKey(), e.getValue(), at));
        }
        sensorRepository.saveAll(rows);
        em.flush();
        scoreUnscored();

        Object[] latest = (Object[]) em.createNativeQuery(
                "SELECT score, predicted_at FROM pm_score WHERE equip_id = :id ORDER BY predicted_at DESC, id DESC LIMIT 1")
                .setParameter("id", equipment.getId()).getSingleResult();
        BigDecimal score = (BigDecimal) latest[0];
        Long eventId = eventRepository.findFirstByEquipIdAndStatusInOrderByCreatedAtDesc(equipment.getId(), OPEN)
                .map(PmEvent::getId).orElse(null);
        return new PmSensorIngestResponse(equipment.getId(), score, levelFor(equipment.getId(), score), eventId);
    }

    /** 점수 없는 측정값 묶음을 모두 계산한다. 계산한 묶음 수를 돌려준다 */
    @Transactional
    public int scoreUnscored() {
        List<Object[]> rows = new NativeSql("""
                SELECT s.equip_id, e.type::text, s.recorded_at, s.metric, s.value
                FROM pm_sensor s
                JOIN pm_equipment e ON e.id = s.equip_id
                WHERE NOT EXISTS (SELECT 1 FROM pm_score p WHERE p.equip_id = s.equip_id AND p.predicted_at = s.recorded_at)
                ORDER BY s.equip_id, s.recorded_at
                """).rows(em);
        if (rows.isEmpty()) {
            return 0;
        }

        // (설비, 측정 시각) 묶음별 측정값. 정렬돼 있으니 설비별 마지막 묶음이 가장 최근 것
        Map<String, Batch> batches = new LinkedHashMap<>();
        Map<Long, Batch> latestByEquip = new HashMap<>();
        for (Object[] r : rows) {
            Long equipId = ((Number) r[0]).longValue();
            LocalDateTime at = toLocalDateTime(r[2]);
            Batch batch = batches.computeIfAbsent(equipId + "@" + at,
                    k -> new Batch(equipId, PmEquipmentType.valueOf((String) r[1]), at));
            batch.values.put((String) r[3], (BigDecimal) r[4]);
            latestByEquip.put(equipId, batch);
        }

        List<PmScore> scores = new ArrayList<>();
        for (Batch b : batches.values()) {
            b.score = PmRules.score(b.type, b.values);
            scores.add(new PmScore(b.equipId, b.score, b.at));
        }
        scoreRepository.saveAll(scores);
        em.flush();

        for (Batch b : latestByEquip.values()) {
            if (isLatestScore(b.equipId, b.at)) {   // 늦게 도착한 옛날 값이면 점검 판단은 건너뛴다
                evaluate(b);
            }
        }
        return batches.size();
    }

    /** 설비 기준(pm_threshold)으로 점수 → 단계. 기준이 없으면 안전 */
    public PmLevel levelFor(Long equipId, BigDecimal score) {
        PmLevel level = PmLevel.SAFE;
        for (PmThreshold t : thresholdRepository.findByEquipIdOrderByMinScoreAsc(equipId)) {
            if (score.compareTo(t.getMinScore()) >= 0) {
                level = t.getLevel();
            }
        }
        return level;
    }

    // ---- 내부 메서드 ----

    private void evaluate(Batch b) {
        PmLevel level = levelFor(b.equipId, b.score);
        if (level == PmLevel.SAFE) {
            return;
        }
        String reason = PmRules.reason(b.type, b.values);
        PmEvent open = eventRepository.findFirstByEquipIdAndStatusInOrderByCreatedAtDesc(b.equipId, OPEN).orElse(null);
        if (open != null && level.ordinal() <= open.getLevel().ordinal()) {
            return;   // 이미 열린 점검 대상이 있고 단계가 그대로이거나 내려갔으면 그대로 둔다
        }

        PmEvent event;
        if (open == null) {
            event = eventRepository.saveAndFlush(new PmEvent(b.equipId, level, b.score, reason));
        } else {
            open.setLevel(level);   // 주의 → 위험으로 올라감
            open.setScore(b.score);
            open.setReason(reason);
            event = open;
        }

        PmEquipment equipment = equipmentRepository.findById(b.equipId).orElseThrow();
        Underpass underpass = underpassRepository.findByIdAndDeletedFalse(equipment.getUnderpassId()).orElse(null);
        Long regionId = underpass == null ? null : underpass.getRegionId();
        String code = String.format("%s-%02d", b.type.getCodePrefix(), equipment.getUnderpassId());
        String title = cut(code + " " + b.type.getLabel() + " " + level.getDbValue() + " 진입 ("
                + b.score.setScale(0, RoundingMode.HALF_UP) + "점)", 100);
        String body = cut((underpass == null ? "" : underpass.getName() + " · ") + reason, 255);
        notificationService.notifyManagers(ManagerNotificationCategory.EQUIPMENT, regionId, title, body,
                "PM_EVENT", event.getId());
        streamPublisher.dataChangedToAdmins(regionId, "pm", open == null ? "CREATE" : "UPDATE", event.getId());
    }

    private boolean isLatestScore(Long equipId, LocalDateTime at) {
        Object max = em.createNativeQuery("SELECT MAX(predicted_at) FROM pm_score WHERE equip_id = :id")
                .setParameter("id", equipId).getSingleResult();
        return max != null && !toLocalDateTime(max).isAfter(at);
    }

    private static LocalDateTime toLocalDateTime(Object value) {
        if (value instanceof java.sql.Timestamp ts) {
            return ts.toLocalDateTime();
        }
        return (LocalDateTime) value;
    }

    private static String cut(String text, int max) {
        return text.length() <= max ? text : text.substring(0, max);
    }

    private static final class Batch {
        final Long equipId;
        final PmEquipmentType type;
        final LocalDateTime at;
        final Map<String, BigDecimal> values = new HashMap<>();
        BigDecimal score;

        Batch(Long equipId, PmEquipmentType type, LocalDateTime at) {
            this.equipId = equipId;
            this.type = type;
            this.at = at;
        }
    }
}
