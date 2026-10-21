package com.mbc.puf.pm.service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mbc.puf.common.exception.BusinessException;
import com.mbc.puf.common.jpa.DbClock;
import com.mbc.puf.common.jpa.NativeSql;
import com.mbc.puf.common.request.ScopeQuery;
import com.mbc.puf.common.security.LoginUser;
import com.mbc.puf.common.security.ScopeResolver;
import com.mbc.puf.pm.dto.PmActionCreateRequest;
import com.mbc.puf.pm.dto.PmActionItem;
import com.mbc.puf.pm.dto.PmEquipmentDetailResponse;
import com.mbc.puf.pm.dto.PmEquipmentItem;
import com.mbc.puf.pm.dto.PmEventItem;
import com.mbc.puf.pm.dto.PmReasonItem;
import com.mbc.puf.pm.dto.PmRuleItem;
import com.mbc.puf.pm.dto.PmThresholdItem;
import com.mbc.puf.pm.dto.PmTrendResponse;
import com.mbc.puf.pm.entity.PmAction;
import com.mbc.puf.pm.entity.PmEquipment;
import com.mbc.puf.pm.entity.PmEquipmentType;
import com.mbc.puf.pm.entity.PmEvent;
import com.mbc.puf.pm.entity.PmEventStatus;
import com.mbc.puf.pm.entity.PmLevel;
import com.mbc.puf.pm.entity.PmThreshold;
import com.mbc.puf.pm.entity.PmThresholdHistory;
import com.mbc.puf.pm.repository.PmActionRepository;
import com.mbc.puf.pm.repository.PmEquipmentRepository;
import com.mbc.puf.pm.repository.PmEventRepository;
import com.mbc.puf.pm.repository.PmThresholdHistoryRepository;
import com.mbc.puf.pm.repository.PmThresholdRepository;
import com.mbc.puf.stream.StreamPublisher;
import com.mbc.puf.underpass.entity.Underpass;
import com.mbc.puf.underpass.repository.UnderpassRepository;

import jakarta.persistence.EntityManager;

@Service
public class PmServiceImpl implements PmService {

    // 설비 한 줄: 최신 점수, 24시간 전 점수, 기준으로 본 단계, 열린 점검 대상
    private static final String EQUIPMENT_SQL = """
            SELECT e.id AS equip_id, e.type::text AS type, e.underpass_id, u.name AS underpass_name, u.region_id,
                   ls.score, ps.score AS prev_score, ls.predicted_at,
                   (SELECT t.level::text FROM pm_threshold t
                     WHERE t.equip_id = e.id AND t.min_score <= ls.score
                     ORDER BY t.min_score DESC LIMIT 1) AS level,
                   oe.id AS open_event_id, oe.status::text AS open_event_status
            FROM pm_equipment e
            JOIN underpass u ON u.id = e.underpass_id AND u.is_deleted = FALSE
            LEFT JOIN LATERAL (SELECT score, predicted_at FROM pm_score
                                WHERE equip_id = e.id ORDER BY predicted_at DESC, id DESC LIMIT 1) ls ON TRUE
            LEFT JOIN LATERAL (SELECT score FROM pm_score
                                WHERE equip_id = e.id AND predicted_at <= ls.predicted_at - INTERVAL '24 hours'
                                ORDER BY predicted_at DESC LIMIT 1) ps ON TRUE
            LEFT JOIN LATERAL (SELECT id, status FROM pm_event
                                WHERE equip_id = e.id AND status IN ('CHECK_NEEDED', 'IN_PROGRESS')
                                ORDER BY created_at DESC LIMIT 1) oe ON TRUE
            WHERE u.region_id IN (:regionIds)
            """;

    private static final String EVENT_SQL = """
            SELECT ev.id AS event_id, ev.equip_id, e.type::text AS type, e.underpass_id, u.name AS underpass_name,
                   ev.level::text AS level, ev.score, ls.score AS current_score, ev.reason, ev.status::text AS status,
                   ev.created_at, la.content AS last_action, la.created_at AS last_action_at
            FROM pm_event ev
            JOIN pm_equipment e ON e.id = ev.equip_id
            JOIN underpass u ON u.id = e.underpass_id AND u.is_deleted = FALSE
            LEFT JOIN LATERAL (SELECT score FROM pm_score
                                WHERE equip_id = ev.equip_id ORDER BY predicted_at DESC, id DESC LIMIT 1) ls ON TRUE
            LEFT JOIN LATERAL (SELECT content, created_at FROM pm_action
                                WHERE event_id = ev.id ORDER BY created_at DESC, id DESC LIMIT 1) la ON TRUE
            WHERE u.region_id IN (:regionIds)
            """;

    private static final String ACTION_SQL = """
            SELECT a.id AS action_id, a.event_id, ev.equip_id, e.type::text AS type, e.underpass_id,
                   u.name AS underpass_name, ev.reason, a.content, a.manager_id, m.login_id AS manager_login_id,
                   a.created_at, ev.score AS event_score, ls.score AS current_score, ev.status::text AS event_status
            FROM pm_action a
            JOIN pm_event ev ON ev.id = a.event_id
            JOIN pm_equipment e ON e.id = ev.equip_id
            JOIN underpass u ON u.id = e.underpass_id AND u.is_deleted = FALSE
            JOIN manager m ON m.id = a.manager_id
            LEFT JOIN LATERAL (SELECT score FROM pm_score
                                WHERE equip_id = ev.equip_id ORDER BY predicted_at DESC, id DESC LIMIT 1) ls ON TRUE
            WHERE u.region_id IN (:regionIds)
            """;

    private final EntityManager em;
    private final ScopeResolver scopeResolver;
    private final PmEquipmentRepository equipmentRepository;
    private final PmEventRepository eventRepository;
    private final PmActionRepository actionRepository;
    private final PmThresholdRepository thresholdRepository;
    private final PmThresholdHistoryRepository thresholdHistoryRepository;
    private final UnderpassRepository underpassRepository;
    private final StreamPublisher streamPublisher;
    private final DbClock dbClock;

    public PmServiceImpl(EntityManager em, ScopeResolver scopeResolver, PmEquipmentRepository equipmentRepository,
                         PmEventRepository eventRepository, PmActionRepository actionRepository,
                         PmThresholdRepository thresholdRepository,
                         PmThresholdHistoryRepository thresholdHistoryRepository,
                         UnderpassRepository underpassRepository, StreamPublisher streamPublisher, DbClock dbClock) {
        this.em = em;
        this.scopeResolver = scopeResolver;
        this.equipmentRepository = equipmentRepository;
        this.eventRepository = eventRepository;
        this.actionRepository = actionRepository;
        this.thresholdRepository = thresholdRepository;
        this.thresholdHistoryRepository = thresholdHistoryRepository;
        this.underpassRepository = underpassRepository;
        this.streamPublisher = streamPublisher;
        this.dbClock = dbClock;
    }

    // ================= 설비 =================

    @Override
    @Transactional(readOnly = true)
    public List<PmEquipmentItem> getEquipments(LoginUser loginUser, PmEquipmentType type, PmLevel level,
                                               Long regionId, Long underpassId) {
        ScopeQuery scope = scopeResolver.resolve(loginUser, ScopeQuery.of(regionId, underpassId));
        List<PmEquipmentItem> items = new NativeSql(EQUIPMENT_SQL)
                .param("regionIds", scope.getRegionIds())
                .andIf(type != null, " AND e.type = CAST(:type AS pm_equipment_type)", "type", type == null ? null : type.name())
                .andIf(scope.getUnderpassId() != null, " AND e.underpass_id = :underpassId", "underpassId", scope.getUnderpassId())
                .append(" ORDER BY ls.score DESC NULLS LAST, e.id")
                .list(em, PmEquipmentItem.class);
        if (level == null) {
            return items;
        }
        return items.stream().filter(i -> level == (i.getLevel() == null ? PmLevel.SAFE : i.getLevel())).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<PmEquipmentItem> getTop(LoginUser loginUser, int limit) {
        ScopeQuery scope = scopeResolver.resolve(loginUser, ScopeQuery.of(null, null));
        return new NativeSql(EQUIPMENT_SQL)
                .param("regionIds", scope.getRegionIds())
                .append(" AND ls.score IS NOT NULL ORDER BY ls.score DESC, e.id LIMIT :limit")
                .param("limit", Math.max(1, Math.min(limit, 50)))
                .list(em, PmEquipmentItem.class);
    }

    @Override
    @Transactional(readOnly = true)
    public PmEquipmentDetailResponse getDetail(LoginUser loginUser, Long equipId) {
        PmEquipment equipment = requireReadable(loginUser, equipId);
        PmEquipmentItem item = findEquipmentItem(loginUser, equipment);

        // 가장 최근 측정 묶음 (점수 근거)
        List<Object[]> rows = new NativeSql("""
                SELECT metric, value, recorded_at FROM pm_sensor
                WHERE equip_id = :id AND recorded_at = (SELECT MAX(recorded_at) FROM pm_sensor WHERE equip_id = :id)
                """).param("id", equipId).rows(em);
        Map<String, BigDecimal> values = new HashMap<>();
        LocalDateTime measuredAt = null;
        for (Object[] r : rows) {
            values.put((String) r[0], (BigDecimal) r[1]);
            measuredAt = toLocalDateTime(r[2]);
        }
        List<PmReasonItem> reasons = new ArrayList<>();
        for (PmRules.Rule rule : PmRules.of(equipment.getType())) {
            BigDecimal value = values.get(rule.metric());
            reasons.add(new PmReasonItem(rule.metric(), rule.label(), rule.unit(), value, rule.limit(),
                    rule.weight(), rule.points(value), rule.status(value)));
        }
        reasons.sort((a, b) -> b.points().compareTo(a.points()));

        boolean needsCheck = item.getLevel() != null && item.getLevel() != PmLevel.SAFE;
        String blockReason = PmRules.blockReason(equipment.getType());
        return new PmEquipmentDetailResponse(item, measuredAt, reasons,
                values.isEmpty() ? null : PmRules.reason(equipment.getType(), values),
                thresholdItems(equipId), needsCheck ? PmRules.advice(equipment.getType()) : null,
                findBlockPresetId(blockReason), blockReason);
    }

    @Override
    @Transactional(readOnly = true)
    public PmTrendResponse getTrend(LoginUser loginUser, Long equipId, int days) {
        requireReadable(loginUser, equipId);
        int d = Math.max(1, Math.min(days, 90));
        List<PmTrendResponse.Point> scores = new NativeSql("""
                SELECT predicted_at, score FROM pm_score
                WHERE equip_id = :id AND predicted_at >= LOCALTIMESTAMP - make_interval(days => :days)
                ORDER BY predicted_at
                """).param("id", equipId).param("days", d).rows(em).stream()
                .map(r -> new PmTrendResponse.Point(toLocalDateTime(r[0]), (BigDecimal) r[1]))
                .toList();
        Map<String, List<PmTrendResponse.Point>> metrics = new LinkedHashMap<>();
        for (Object[] r : new NativeSql("""
                SELECT metric, recorded_at, value FROM pm_sensor
                WHERE equip_id = :id AND recorded_at >= LOCALTIMESTAMP - make_interval(days => :days)
                ORDER BY metric, recorded_at
                """).param("id", equipId).param("days", d).rows(em)) {
            metrics.computeIfAbsent((String) r[0], k -> new ArrayList<>())
                    .add(new PmTrendResponse.Point(toLocalDateTime(r[1]), (BigDecimal) r[2]));
        }
        return new PmTrendResponse(scores, metrics);
    }

    // ================= 점검 대상·조치 =================

    @Override
    @Transactional(readOnly = true)
    public List<PmEventItem> getEvents(LoginUser loginUser, boolean openOnly, PmEquipmentType type) {
        ScopeQuery scope = scopeResolver.resolve(loginUser, ScopeQuery.of(null, null));
        return new NativeSql(EVENT_SQL)
                .param("regionIds", scope.getRegionIds())
                .append(openOnly ? " AND ev.status IN ('CHECK_NEEDED', 'IN_PROGRESS')" : "")
                .andIf(type != null, " AND e.type = CAST(:type AS pm_equipment_type)", "type", type == null ? null : type.name())
                .append(" ORDER BY CASE ev.status WHEN 'CHECK_NEEDED' THEN 0 WHEN 'IN_PROGRESS' THEN 1 ELSE 2 END,"
                        + " ev.level DESC, ev.created_at DESC")
                .list(em, PmEventItem.class);
    }

    @Override
    @Transactional
    public PmEventItem changeStatus(LoginUser loginUser, Long eventId, PmEventStatus status) {
        PmEvent event = requireOwnableEvent(loginUser, eventId);
        moveStatus(event, status);
        em.flush();
        publish(event, "UPDATE");
        return findEventItem(loginUser, eventId);
    }

    @Override
    @Transactional
    public PmActionItem addAction(LoginUser loginUser, Long eventId, PmActionCreateRequest request) {
        PmEvent event = requireOwnableEvent(loginUser, eventId);
        if (!event.getStatus().isOpen()) {
            throw new BusinessException(HttpStatus.CONFLICT, "이미 처리가 끝난 점검 대상입니다.");
        }
        if (request.status() != null && request.status() != event.getStatus()) {
            moveStatus(event, request.status());
        }
        PmAction action = actionRepository.saveAndFlush(new PmAction(eventId, request.content().trim(), loginUser.id()));
        publish(event, "UPDATE");
        ScopeQuery scope = scopeResolver.resolve(loginUser, ScopeQuery.of(null, null));
        return new NativeSql(ACTION_SQL)
                .param("regionIds", scope.getRegionIds())
                .append(" AND a.id = :actionId").param("actionId", action.getId())
                .single(em, PmActionItem.class);
    }

    @Override
    @Transactional(readOnly = true)
    public List<PmActionItem> getActions(LoginUser loginUser, PmEquipmentType type, Long equipId) {
        ScopeQuery scope = scopeResolver.resolve(loginUser, ScopeQuery.of(null, null));
        return new NativeSql(ACTION_SQL)
                .param("regionIds", scope.getRegionIds())
                .andIf(type != null, " AND e.type = CAST(:type AS pm_equipment_type)", "type", type == null ? null : type.name())
                .andIf(equipId != null, " AND ev.equip_id = :equipId", "equipId", equipId)
                .append(" ORDER BY a.created_at DESC, a.id DESC LIMIT 200")
                .list(em, PmActionItem.class);
    }

    // ================= 기준 =================

    @Override
    @Transactional(readOnly = true)
    public List<PmThresholdItem> getThresholds(LoginUser loginUser, Long equipId) {
        requireReadable(loginUser, equipId);
        return thresholdItems(equipId);
    }

    @Override
    @Transactional
    public PmThresholdItem updateThreshold(LoginUser loginUser, Long equipId, PmLevel level, BigDecimal minScore) {
        PmEquipment equipment = requireReadable(loginUser, equipId);
        Long regionId = regionOf(equipment);
        scopeResolver.requireOwnable(loginUser, regionId);
        if (level == PmLevel.SAFE && minScore.signum() != 0) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "안전 기준은 0점으로 고정입니다.");
        }

        List<PmThreshold> rows = thresholdRepository.findByEquipIdOrderByMinScoreAsc(equipId);
        PmThreshold target = rows.stream().filter(t -> t.getLevel() == level).findFirst()
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND,
                        "존재하지 않는 기준입니다. equipId=" + equipId + ", level=" + level));
        // 바꾼 뒤에도 안전 < 주의 < 위험 순서가 지켜지는지
        Map<PmLevel, BigDecimal> after = new HashMap<>();
        rows.forEach(t -> after.put(t.getLevel(), t.getMinScore()));
        after.put(level, minScore);
        BigDecimal caution = after.get(PmLevel.CAUTION);
        BigDecimal danger = after.get(PmLevel.DANGER);
        if (caution != null && danger != null && caution.compareTo(danger) >= 0) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "주의 기준은 위험 기준보다 낮아야 합니다.");
        }
        if (caution != null && caution.signum() <= 0) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "주의 기준은 0점보다 커야 합니다.");
        }

        BigDecimal old = target.getMinScore();
        target.setMinScore(minScore);
        target.setUpdatedBy(loginUser.id());
        target.setUpdatedAt(dbClock.now());
        thresholdHistoryRepository.save(new PmThresholdHistory(target.getId(), old, minScore, loginUser.id()));
        em.flush();
        em.refresh(target);
        streamPublisher.dataChangedToAdmins(regionId, "pm-threshold", "UPDATE", equipId);
        return PmThresholdItem.of(target);
    }

    @Override
    public List<PmRuleItem> getRules() {
        return Arrays.stream(PmEquipmentType.values())
                .map(t -> new PmRuleItem(t, t.getLabel(), PmRules.of(t)))
                .toList();
    }

    // ---- 내부 메서드 ----

    // 설비가 있고, 담당 지역 안이면 통과 (밖이면 ScopeResolver 가 403)
    private PmEquipment requireReadable(LoginUser loginUser, Long equipId) {
        PmEquipment equipment = equipmentRepository.findById(equipId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "존재하지 않는 설비입니다. id=" + equipId));
        scopeResolver.resolve(loginUser, ScopeQuery.of(null, equipment.getUnderpassId()));
        return equipment;
    }

    private PmEvent requireOwnableEvent(LoginUser loginUser, Long eventId) {
        PmEvent event = eventRepository.findById(eventId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "존재하지 않는 점검 대상입니다. id=" + eventId));
        PmEquipment equipment = equipmentRepository.findById(event.getEquipId()).orElseThrow();
        scopeResolver.requireOwnable(loginUser, regionOf(equipment));
        return event;
    }

    private void moveStatus(PmEvent event, PmEventStatus next) {
        if (!event.getStatus().canMoveTo(next)) {
            throw new BusinessException(HttpStatus.CONFLICT,
                    "'" + event.getStatus().getLabel() + "' 상태에서 '" + next.getLabel() + "'(으)로 바꿀 수 없습니다.");
        }
        event.setStatus(next);
    }

    private void publish(PmEvent event, String action) {
        PmEquipment equipment = equipmentRepository.findById(event.getEquipId()).orElseThrow();
        streamPublisher.dataChangedToAdmins(regionOf(equipment), "pm", action, event.getId());
    }

    private Long regionOf(PmEquipment equipment) {
        return underpassRepository.findByIdAndDeletedFalse(equipment.getUnderpassId())
                .map(Underpass::getRegionId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "설비의 지하차도가 없습니다."));
    }

    private PmEquipmentItem findEquipmentItem(LoginUser loginUser, PmEquipment equipment) {
        ScopeQuery scope = scopeResolver.resolve(loginUser, ScopeQuery.of(null, equipment.getUnderpassId()));
        return new NativeSql(EQUIPMENT_SQL)
                .param("regionIds", scope.getRegionIds())
                .append(" AND e.id = :equipId").param("equipId", equipment.getId())
                .single(em, PmEquipmentItem.class);
    }

    private PmEventItem findEventItem(LoginUser loginUser, Long eventId) {
        ScopeQuery scope = scopeResolver.resolve(loginUser, ScopeQuery.of(null, null));
        return new NativeSql(EVENT_SQL)
                .param("regionIds", scope.getRegionIds())
                .append(" AND ev.id = :eventId").param("eventId", eventId)
                .single(em, PmEventItem.class);
    }

    private List<PmThresholdItem> thresholdItems(Long equipId) {
        return thresholdRepository.findByEquipIdOrderByMinScoreAsc(equipId).stream().map(PmThresholdItem::of).toList();
    }

    // 팀 차단 사유 프리셋(reason_preset) 중 같은 문구가 있으면 그 번호
    private Long findBlockPresetId(String content) {
        List<?> ids = em.createNativeQuery("SELECT id FROM reason_preset WHERE content = :c ORDER BY id LIMIT 1")
                .setParameter("c", content).getResultList();
        return ids.isEmpty() ? null : ((Number) ids.get(0)).longValue();
    }

    private static LocalDateTime toLocalDateTime(Object value) {
        if (value instanceof java.sql.Timestamp ts) {
            return ts.toLocalDateTime();
        }
        return (LocalDateTime) value;
    }
}
