package com.mbc.puf.pm.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mbc.puf.common.enums.ManagerNotificationCategory;
import com.mbc.puf.common.enums.PmEquipmentType;
import com.mbc.puf.common.enums.PmEventStatus;
import com.mbc.puf.common.enums.PmLevel;
import com.mbc.puf.notification.service.NotificationService;
import com.mbc.puf.pm.dto.PmInternalEquipmentItem;
import com.mbc.puf.pm.dto.PmScoreIngestItem;
import com.mbc.puf.pm.dto.PmScoreIngestRequest;
import com.mbc.puf.pm.dto.PmScoreIngestResponse;
import com.mbc.puf.pm.dto.PmStreamPayloads;
import com.mbc.puf.pm.entity.PmEvent;
import com.mbc.puf.pm.entity.PmThreshold;
import com.mbc.puf.pm.repository.PmEquipmentRepository;
import com.mbc.puf.pm.repository.PmEquipmentRepository.EquipmentRow;
import com.mbc.puf.pm.repository.PmEventRepository;
import com.mbc.puf.pm.repository.PmScoreRepository;
import com.mbc.puf.pm.repository.PmThresholdRepository;
import com.mbc.puf.stream.StreamPublisher;

import tools.jackson.databind.ObjectMapper;

/**
 * 예지보전 점수 수신.
 *
 * 점수 1건마다:
 *   ① 같은 설비·같은 시각이 이미 있으면 건너뜀
 *   ② pm_threshold 로 단계 판정 → pm_score 에 점수·단계·사유·세부값 저장
 *   ③ backfill 이면 여기서 끝 (이벤트·알림·SSE 없음)
 *   ④ 주의 이상이면: 처리 중 이벤트가 없으면 새로 만들고 관리자 알림,
 *                    있으면 단계가 올라갈 때만 그 이벤트 단계를 올리고 알림, 그 밖에는 아무것도 안 함
 * 묶음이 끝나면 지역마다 SSE "pm-update" 를 한 번씩 보낸다.
 *
 * 부하를 줄이려고 묶음당 조회는 3번(설비, 임계치, 처리 중 이벤트)만 하고, 나머지는 메모리에서 판정한다.
 */
@Service
public class PmIngestServiceImpl implements PmIngestService {

    private static final List<PmEventStatus> OPEN_STATUSES = List.of(PmEventStatus.CHECK_NEEDED, PmEventStatus.IN_PROGRESS);
    private static final Map<PmEquipmentType, String> TYPE_KO = Map.of(
            PmEquipmentType.CCTV, "CCTV", PmEquipmentType.DISPLAY, "전광판",
            PmEquipmentType.PUMP, "배수펌프", PmEquipmentType.WATER_LEVEL, "수위센서");

    private final PmEquipmentRepository equipmentRepository;
    private final PmScoreRepository scoreRepository;
    private final PmThresholdRepository thresholdRepository;
    private final PmEventRepository eventRepository;
    private final NotificationService notificationService;
    private final StreamPublisher streamPublisher;
    private final ObjectMapper objectMapper;

    public PmIngestServiceImpl(PmEquipmentRepository equipmentRepository, PmScoreRepository scoreRepository,
            PmThresholdRepository thresholdRepository, PmEventRepository eventRepository,
            NotificationService notificationService, StreamPublisher streamPublisher, ObjectMapper objectMapper) {
        this.equipmentRepository = equipmentRepository;
        this.scoreRepository = scoreRepository;
        this.thresholdRepository = thresholdRepository;
        this.eventRepository = eventRepository;
        this.notificationService = notificationService;
        this.streamPublisher = streamPublisher;
        this.objectMapper = objectMapper;
    }

    @Override
    @Transactional(readOnly = true)
    public List<PmInternalEquipmentItem> getEquipments() {
        return equipmentRepository.findAllRows().stream()
                .map(r -> new PmInternalEquipmentItem(r.getEquipId(), r.getName(), r.getType(), r.getUnderpassId(), r.getUnderpassName(),
                        r.getSensorIntervalSec(), r.getDataStartedAt() == null ? null : r.getDataStartedAt().toLocalDateTime()))
                .toList();
    }

    @Override
    @Transactional
    public PmScoreIngestResponse receiveScores(PmScoreIngestRequest request) {
        List<PmScoreIngestItem> items = new ArrayList<>(request.getScores());
        items.sort(Comparator.comparing(PmScoreIngestItem::getPredictedAt));   // 같은 설비가 여러 건이면 시간 순서대로

        Set<Long> ids = items.stream().map(PmScoreIngestItem::getEquipId).collect(Collectors.toSet());
        Map<Long, EquipmentRow> equipments = equipmentRepository.findRowsByIds(ids).stream()
                .collect(Collectors.toMap(EquipmentRow::getEquipId, r -> r));
        Map<Long, List<PmThreshold>> thresholds = thresholdRepository.findByEquipIdIn(equipments.keySet()).stream()
                .collect(Collectors.groupingBy(PmThreshold::getEquipId));
        Map<Long, PmEvent> openEvents = new HashMap<>();
        if (!request.isBackfill()) {
            for (PmEvent e : eventRepository.findByEquipIdInAndStatusIn(equipments.keySet(), OPEN_STATUSES)) {
                openEvents.merge(e.getEquipId(), e, (a, b) -> a.getId() > b.getId() ? a : b);   // 혹시 여러 건이면 최신 것
            }
        }

        int saved = 0, duplicated = 0, unknown = 0, created = 0, raised = 0;
        Map<Long, PmStreamPayloads.Item> latest = new LinkedHashMap<>();   // SSE 용: 설비별 마지막 점수
        Map<Long, Long> regionOf = new HashMap<>();
        LocalDateTime lastAt = null;

        for (PmScoreIngestItem it : items) {
            EquipmentRow eq = equipments.get(it.getEquipId());
            if (eq == null) {
                unknown++;
                continue;
            }
            BigDecimal score = it.getScore().setScale(2, RoundingMode.HALF_UP);
            PmLevel level = judge(score, thresholds.get(eq.getEquipId()));
            int n = scoreRepository.insertIgnoreDuplicate(eq.getEquipId(), score, it.getPredictedAt(), level.getDbValue(),
                    toJson(it.getReasons() == null ? List.of() : it.getReasons()), toJson(it.getDetail()), it.getModelVersion());
            if (n == 0) {
                duplicated++;
                continue;
            }
            saved++;
            if (request.isBackfill()) {
                continue;
            }

            PmEquipmentType type = PmEquipmentType.valueOf(eq.getType());
            latest.put(eq.getEquipId(), new PmStreamPayloads.Item(eq.getEquipId(), eq.getUnderpassId(), type, score, level));
            regionOf.put(eq.getEquipId(), eq.getRegionId());
            lastAt = it.getPredictedAt();

            if (!level.atLeast(PmLevel.CAUTION)) {
                continue;
            }
            PmEvent open = openEvents.get(eq.getEquipId());
            if (open == null) {
                PmEvent ev = new PmEvent();
                ev.setEquipId(eq.getEquipId());
                ev.setLevel(level);
                ev.setScore(score);
                ev.setStatus(PmEventStatus.CHECK_NEEDED);
                eventRepository.save(ev);
                openEvents.put(eq.getEquipId(), ev);
                created++;
                notify(eq, type, level, score, ev.getId(), "설비 점검 필요");
            } else if (level.ordinal() > open.getLevel().ordinal()) {
                open.setLevel(level);
                open.setScore(score);
                raised++;
                notify(eq, type, level, score, open.getId(), "설비 위험 상승");
            }
        }

        // 실시간: 지역마다 한 번만
        if (!latest.isEmpty()) {
            Map<Long, List<PmStreamPayloads.Item>> byRegion = latest.values().stream()
                    .collect(Collectors.groupingBy(i -> regionOf.get(i.equipId()), LinkedHashMap::new, Collectors.toList()));
            for (Map.Entry<Long, List<PmStreamPayloads.Item>> e : byRegion.entrySet()) {
                streamPublisher.publishToAdmins(e.getKey(), "pm-update",
                        new PmStreamPayloads.PmUpdate(e.getKey(), lastAt, e.getValue()));
            }
        }
        return new PmScoreIngestResponse(items.size(), saved, duplicated, unknown, created, raised);
    }

    /** 점수가 넘은 임계치 중 가장 높은 단계 (판정 규칙은 PmJudge, 임계치 수정 후 재판정과 같이 쓴다) */
    private PmLevel judge(BigDecimal score, List<PmThreshold> rows) {
        return PmJudge.judge(score, rows);
    }

    private void notify(EquipmentRow eq, PmEquipmentType type, PmLevel level, BigDecimal score, Long eventId, String title) {
        String body = String.format("%s %s %s 단계 (%s점)", eq.getUnderpassName(), TYPE_KO.get(type), level.getDbValue(),
                score.stripTrailingZeros().toPlainString());
        notificationService.notifyManagers(ManagerNotificationCategory.EQUIPMENT, eq.getRegionId(), title, body,
                "PM_EVENT", eventId);
    }

    private String toJson(Object value) {
        return value == null ? null : objectMapper.writeValueAsString(value);
    }
}
