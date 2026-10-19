package com.mbc.puf.underpass.service;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;

import org.springframework.data.domain.Limit;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mbc.puf.common.enums.ReviewStatus;
import com.mbc.puf.common.enums.TransitStatus;
import com.mbc.puf.common.enums.UnderpassCurrentStatus;
import com.mbc.puf.common.enums.UnderpassEventType;
import com.mbc.puf.common.exception.BusinessException;
import com.mbc.puf.common.jpa.DbClock;
import com.mbc.puf.common.query.PagedQuery;
import com.mbc.puf.common.query.QueryConditions;
import com.mbc.puf.common.request.PageParams;
import com.mbc.puf.common.request.PageQuery;
import com.mbc.puf.common.request.PeriodQuery;
import com.mbc.puf.common.request.ScopeQuery;
import com.mbc.puf.common.request.VehicleQuery;
import com.mbc.puf.common.response.PageResponse;
import com.mbc.puf.common.security.LoginUser;
import com.mbc.puf.common.security.ScopeResolver;
import com.mbc.puf.internal.dto.RiskScoreTrendItem;
import com.mbc.puf.internal.entity.RiskScore;
import com.mbc.puf.internal.repository.RiskScoreRepository;
import com.mbc.puf.threshold.service.ThresholdService;
import com.mbc.puf.underpass.dto.GateCameraRequest;
import com.mbc.puf.underpass.dto.ControlHistoryItem;
import com.mbc.puf.underpass.dto.TransitHistoryItem;
import com.mbc.puf.underpass.dto.UnderpassCreateRequest;
import com.mbc.puf.underpass.dto.UnderpassDetailResponse;
import com.mbc.puf.underpass.dto.UnderpassListItem;
import com.mbc.puf.underpass.dto.UnderpassUpdateRequest;
import com.mbc.puf.underpass.entity.Camera;
import com.mbc.puf.underpass.entity.Transit;
import com.mbc.puf.underpass.entity.Underpass;
import com.mbc.puf.underpass.entity.UnderpassEvent;
import com.mbc.puf.underpass.repository.CameraRepository;
import com.mbc.puf.underpass.repository.TransitRepository;
import com.mbc.puf.underpass.repository.UnderpassEventRepository;
import com.mbc.puf.underpass.repository.UnderpassRepository;

import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import jakarta.persistence.TypedQuery;

@Service
public class UnderpassServiceImpl implements UnderpassService {


    // 지하차도 목록은 지도에 한 번에 뿌리는 용도가 있어서(2차 범위 100개 이상) 페이지 상한을 따로 크게 둔다
    private static final int UNDERPASS_LIST_MAX_SIZE = 500;

    // hours 없이 limit만 쓸 때의 기본 개수(기존 동작과 동일)
    private static final int DEFAULT_RISK_SCORE_LIMIT = 24;
    // hours를 쓰는데 limit을 안 줬을 때의 안전 상한. 스케줄러가 60초마다 지하차도당 1건씩 쌓는 구조라
    // 하루(24시간)치를 다 받아도 1440건 남짓 — 넉넉하게 3000으로 잡아둔다
    private static final int HOURS_SAFETY_LIMIT = 3000;
    // 잔류/장시간 IN_TRANSIT 차량을 자동으로 "통과완료" 처리하기까지 기다리는 시간(분). 2026-10-01 확정값
    // (※ 새 DB 구조 단계에서 이 타이머는 삭제 예정 — 소방 보고 흐름과 충돌)
    private static final int AUTO_EXIT_MINUTES = 2;

    // 목록용: 지역명 + 최신 위험점수 1건 + 판별대기 건수 + 잔류차량 건수를 한 번에 (예전 LATERAL JOIN 3개와 같음)
    private static final String LIST_SELECT = "select u, r.name,"
            + " (select rs.riskScore from RiskScore rs where rs.underpassId = u.id order by rs.predictedAt desc limit 1) as riskScore,"
            + " (select count(p) from PlateLog p join Camera c on c.id = p.cameraId"
            + "   where c.underpassId = u.id and p.reviewStatus = com.mbc.puf.common.enums.ReviewStatus.PENDING),"
            + " (select count(t) from Transit t"
            + "   where t.underpassId = u.id and t.status = com.mbc.puf.common.enums.TransitStatus.REMAINING)"
            + " from Underpass u left join Region r on r.id = u.regionId";

    private final UnderpassRepository underpassRepository;
    private final UnderpassEventRepository eventRepository;
    private final TransitRepository transitRepository;
    private final CameraRepository cameraRepository;
    private final RiskScoreRepository riskScoreRepository;
    private final ThresholdService thresholdService;
    private final ScopeResolver scopeResolver;
    private final DbClock dbClock;
    private final EntityManager em;

    public UnderpassServiceImpl(UnderpassRepository underpassRepository, UnderpassEventRepository eventRepository,
                                TransitRepository transitRepository,
                                CameraRepository cameraRepository, RiskScoreRepository riskScoreRepository,
                                ThresholdService thresholdService, ScopeResolver scopeResolver,
                                DbClock dbClock, EntityManager em) {
        this.underpassRepository = underpassRepository;
        this.eventRepository = eventRepository;
        this.transitRepository = transitRepository;
        this.cameraRepository = cameraRepository;
        this.riskScoreRepository = riskScoreRepository;
        this.thresholdService = thresholdService;
        this.scopeResolver = scopeResolver;
        this.dbClock = dbClock;
        this.em = em;
    }

    // ---- 조회: 로그인 없이 공개 ----

    @Override
    @Transactional(readOnly = true)
    public PageResponse<UnderpassListItem> getUnderpassList(Long regionId, String keyword,
                                                            UnderpassCurrentStatus status, Sort sort,
                                                            PageQuery page) {
        PageParams pageParams = page.toParams(UNDERPASS_LIST_MAX_SIZE);
        QueryConditions c = new QueryConditions()
                .add("u.deleted = false")
                .eqIfPresent("u.regionId", regionId)          // 안 주면 전체 지역
                .eqIfPresent("u.currentStatus", status)       // NORMAL/BLOCKED
                .containsIfPresent(keyword, "u.name");        // 이름 검색

        String orderBy = switch (sort == null ? Sort.NAME : sort) {
            case NAME -> " order by u.name asc, u.id asc";
            case RISK_SCORE -> " order by riskScore desc nulls last, u.name asc, u.id asc";
            case LATEST -> " order by u.createdAt desc, u.id desc";
        };
        return PagedQuery.fetch(em, LIST_SELECT, "select count(u) from Underpass u", c, orderBy,
                Object[].class, this::toListItem, pageParams);
    }

    @Override
    @Transactional(readOnly = true)
    public UnderpassDetailResponse getUnderpass(Long id) {
        return toDetail(requireExistingUnderpass(id));
    }

    @Override
    @Transactional(readOnly = true)
    public List<RiskScoreTrendItem> getRiskScoreTrend(Long id, Integer limit, Integer hours) {
        requireExistingUnderpass(id);   // 존재하지 않으면 404
        int effectiveLimit = limit != null ? limit : (hours != null ? HOURS_SAFETY_LIMIT : DEFAULT_RISK_SCORE_LIMIT);

        List<RiskScore> recent = (hours == null)
                ? riskScoreRepository.findByUnderpassIdOrderByPredictedAtDesc(id, Limit.of(effectiveLimit))
                : riskScoreRepository.findByUnderpassIdAndPredictedAtGreaterThanEqualOrderByPredictedAtDesc(
                        id, dbClock.now().minusHours(hours), Limit.of(effectiveLimit));

        List<RiskScoreTrendItem> items = new ArrayList<>(recent.stream().map(UnderpassServiceImpl::toTrendItem).toList());
        Collections.reverse(items);   // DB에서는 최신순으로 가져왔으니, 그래프용으로 시간 오름차순으로 뒤집는다
        return items;
    }

    // ---- 등록/수정/삭제: REGIONAL_ADMIN은 본인 담당 지역만 ----

    @Override
    @Transactional
    public UnderpassDetailResponse createUnderpass(LoginUser loginUser, UnderpassCreateRequest request) {
        requireOwnableRegion(loginUser, request.getRegionId());

        Underpass underpass = new Underpass();
        underpass.setName(request.getName().trim());
        underpass.setRegionId(request.getRegionId());
        underpass.setRoadAddress(request.getRoadAddress());
        underpass.setLatitude(request.getLatitude());
        underpass.setLongitude(request.getLongitude());
        underpass.setHeightM(request.getHeightM());
        underpass.setLengthM(request.getLengthM());
        underpass.setWidthM(request.getWidthM());
        underpass.setWaterDistM(request.getWaterDistM());
        underpass.setFloodHistoryCount(request.getFloodHistoryCount());
        underpass.setCurrentStatus(UnderpassCurrentStatus.NORMAL);   // 등록 시 항상 정상 상태로 고정
        underpassRepository.saveAndFlush(underpass);

        thresholdService.createDefaultThresholds(underpass.getId(), loginUser.id());   // SAFE/WARNING/DANGER 3행 기본 생성
        return toDetail(reload(underpass));
    }

    @Override
    @Transactional
    public UnderpassDetailResponse updateUnderpass(LoginUser loginUser, Long id, UnderpassUpdateRequest request) {
        Underpass underpass = requireExistingUnderpass(id);
        requireOwnableRegion(loginUser, underpass.getRegionId());      // 지금 속한 지역이 본인 담당인지
        requireOwnableRegion(loginUser, request.getRegionId());        // 옮기려는 지역도 본인 담당인지

        // 상태(currentStatus/currentBlockEventId)는 여기서 건드리지 않는다
        underpass.setName(request.getName().trim());
        underpass.setRegionId(request.getRegionId());
        underpass.setRoadAddress(request.getRoadAddress());
        underpass.setLatitude(request.getLatitude());
        underpass.setLongitude(request.getLongitude());
        underpass.setHeightM(request.getHeightM());
        underpass.setLengthM(request.getLengthM());
        underpass.setWidthM(request.getWidthM());
        underpass.setWaterDistM(request.getWaterDistM());
        underpass.setFloodHistoryCount(request.getFloodHistoryCount());
        return toDetail(reload(underpass));
    }

    @Override
    @Transactional
    public void deleteUnderpass(LoginUser loginUser, Long id) {
        Underpass underpass = requireExistingUnderpass(id);
        requireOwnableRegion(loginUser, underpass.getRegionId());
        underpass.setDeleted(true);
    }

    // ---- 차단/해제 (MP-10): REGIONAL_ADMIN은 본인 담당 지역만 ----

    @Override
    @Transactional
    public UnderpassDetailResponse blockUnderpass(LoginUser loginUser, Long id) {
        Underpass underpass = requireExistingUnderpass(id);
        requireOwnableRegion(loginUser, underpass.getRegionId());
        if (underpass.getCurrentStatus() == UnderpassCurrentStatus.BLOCKED) {
            throw new BusinessException(HttpStatus.CONFLICT, "이미 차단된 지하차도입니다.");
        }

        UnderpassEvent event = saveOperatorEvent(id, UnderpassEventType.BLOCK, loginUser.id());
        underpass.setCurrentStatus(UnderpassCurrentStatus.BLOCKED);
        underpass.setCurrentBlockEventId(event.getId());

        // 차단 시점에 안에 있던(IN_TRANSIT) 차량을 REMAINING으로 일괄 처리.
        // (일괄 UPDATE는 실행 전에 위 변경을 먼저 DB에 반영한 뒤 영속성 컨텍스트를 비우므로, 응답은 다시 읽어서 만든다)
        transitRepository.markRemaining(id);
        return toDetail(requireExistingUnderpass(id));
    }

    @Override
    @Transactional
    public UnderpassDetailResponse releaseUnderpass(LoginUser loginUser, Long id) {
        Underpass underpass = requireExistingUnderpass(id);
        requireOwnableRegion(loginUser, underpass.getRegionId());
        if (underpass.getCurrentStatus() == UnderpassCurrentStatus.NORMAL) {
            throw new BusinessException(HttpStatus.CONFLICT, "이미 정상 상태인 지하차도입니다.");
        }

        saveOperatorEvent(id, UnderpassEventType.RELEASE, loginUser.id());
        underpass.setCurrentStatus(UnderpassCurrentStatus.NORMAL);
        underpass.setCurrentBlockEventId(null);   // 해제되면 차단 이벤트 연결도 비운다
        return toDetail(underpass);
    }

    // ---- 상행/하행 입·출구 카메라 지정 (MP-10-1): 담당 지역만 ----

    @Override
    @Transactional
    public UnderpassDetailResponse assignGateCameras(LoginUser loginUser, Long id, GateCameraRequest request) {
        Underpass underpass = requireExistingUnderpass(id);
        requireOwnableRegion(loginUser, underpass.getRegionId());

        List<Long> assigned = new ArrayList<>();
        for (Long cameraId : new Long[] { request.getUpEntryCameraId(), request.getUpExitCameraId(),
                request.getDownEntryCameraId(), request.getDownExitCameraId() }) {
            if (cameraId == null) {
                continue;
            }
            if (assigned.contains(cameraId)) {
                throw new BusinessException(HttpStatus.BAD_REQUEST, "한 카메라를 두 자리에 지정할 수 없습니다. cameraId=" + cameraId);
            }
            requireCameraOfThisUnderpass(id, cameraId);
            assigned.add(cameraId);
        }

        underpass.setUpEntryCameraId(request.getUpEntryCameraId());
        underpass.setUpExitCameraId(request.getUpExitCameraId());
        underpass.setDownEntryCameraId(request.getDownEntryCameraId());
        underpass.setDownExitCameraId(request.getDownExitCameraId());
        return toDetail(underpass);
    }

    // ---- 통과 기록 / 제어이력 조회 ----

    @Override
    @Transactional(readOnly = true)
    public PageResponse<TransitHistoryItem> getTransitHistory(LoginUser loginUser, ScopeQuery scope,
                                                              TransitStatus status, VehicleQuery vehicle,
                                                              PeriodQuery period, PageQuery page) {
        // 지역을 안 주면 내 담당 지역 전체, 담당 밖 지역·시설을 지정하면 403
        ScopeQuery resolved = scopeResolver.resolve(loginUser, scope);
        QueryConditions c = new QueryConditions()
                .eqIfPresent("t.underpassId", resolved.getUnderpassId())
                .inIfPresent("u.regionId", resolved.getRegionIds())
                .eqIfPresent("t.status", status)
                .carNumIfPresent(vehicle.getCarNum(), "t.carNum")
                .periodIfPresent("t.entryAt", period);   // 진입 시각 기준

        String from = " from Transit t join Underpass u on u.id = t.underpassId";
        return PagedQuery.fetch(em, "select t, u.name" + from, "select count(t)" + from, c,
                " order by t.entryAt desc, t.id desc", Object[].class, row -> {
                    Transit t = (Transit) row[0];
                    return new TransitHistoryItem(t.getId(), t.getUnderpassId(), (String) row[1], t.getCarNum(),
                            t.getStatus(), t.getEntryAt(), t.getExitAt());
                }, page.toParams());
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<ControlHistoryItem> getControlHistory(Long id, String kind, PeriodQuery period,
                                                              PageQuery page) {
        Underpass underpass = requireExistingUnderpass(id);
        PageParams pageParams = page.toParams();

        // 이벤트와 전광판 조작을 각각 "이번 페이지까지 필요한 만큼"만 최신순으로 가져와서 합친 뒤 잘라낸다
        // (예전 UNION ALL + ORDER BY created_at DESC 와 같은 결과)
        int needed = (int) pageParams.getOffset() + pageParams.getSize();
        List<ControlHistoryItem> merged = new ArrayList<>();
        long total = 0;

        if (!"DISPLAY".equals(kind)) {
            QueryConditions c = new QueryConditions().add("e.underpassId = ?", id).periodIfPresent("e.createdAt", period);
            merged.addAll(top(c, "select e from UnderpassEvent e", " order by e.createdAt desc, e.id desc",
                    UnderpassEvent.class, needed).stream()
                    .map(e -> new ControlHistoryItem("EVENT", id, underpass.getName(), e.getEventType(),
                            e.getRiskLevel(), e.getRiskScoreAtEvent(), e.getReason(), null, e.getOperatorId(),
                            e.getCreatedAt()))
                    .toList());
            total += count(c, "select count(e) from UnderpassEvent e");
        }
        if (!"EVENT".equals(kind)) {
            // 전광판 문구 변경 이력: display_history → display_page → pm_equipment(전광판 설비) → underpass
            String where = " WHERE pe.underpass_id = :id"
                    + (period != null && period.startAt() != null ? " AND dh.changed_at >= :fromAt" : "")
                    + (period != null && period.endAtExclusive() != null ? " AND dh.changed_at < :toAt" : "");
            String from = " FROM display_history dh JOIN display_page dp ON dp.id = dh.page_id"
                    + " JOIN pm_equipment pe ON pe.id = dp.equip_id";
            Query rowsQuery = em.createNativeQuery("SELECT dh.new_content, dh.changed_by, dh.changed_at" + from + where
                    + " ORDER BY dh.changed_at DESC, dh.id DESC").setMaxResults(needed);
            Query countQuery = em.createNativeQuery("SELECT COUNT(*)" + from + where);
            for (Query q : List.of(rowsQuery, countQuery)) {
                q.setParameter("id", id);
                if (period != null && period.startAt() != null) {
                    q.setParameter("fromAt", period.startAt());
                }
                if (period != null && period.endAtExclusive() != null) {
                    q.setParameter("toAt", period.endAtExclusive());
                }
            }
            for (Object row : rowsQuery.getResultList()) {
                Object[] r = (Object[]) row;
                merged.add(new ControlHistoryItem("DISPLAY", id, underpass.getName(), null, null, null, null,
                        (String) r[0], ((Number) r[1]).longValue(), toLocalDateTime(r[2])));
            }
            total += ((Number) countQuery.getSingleResult()).longValue();
        }

        merged.sort(Comparator.comparing(ControlHistoryItem::getCreatedAt).reversed());
        int from = (int) Math.min(pageParams.getOffset(), merged.size());
        int to = Math.min(from + pageParams.getSize(), merged.size());
        return new PageResponse<>(merged.subList(from, to), pageParams.getPage(), pageParams.getSize(), total);
    }

    // ---- 잔류/장시간 IN_TRANSIT 차량 자동 종료 (스케줄러 전용) ----

    @Override
    @Transactional
    public int expireStaleTransits() {
        var now = dbClock.now();
        return transitRepository.expireStale(now, now.minusMinutes(AUTO_EXIT_MINUTES));
    }

    // ---- 내부 메서드 ----

    // 삭제되지 않은 지하차도, 없으면 404 (지역 제한 없음 — 조회는 관리자 모두 허용)
    private Underpass requireExistingUnderpass(Long id) {
        return underpassRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "존재하지 않는 지하차도입니다. id=" + id));
    }

    // REGIONAL_ADMIN이 자기 담당 지역이 아닌 regionId를 등록/수정/삭제 대상으로 쓰면 차단
    private void requireOwnableRegion(LoginUser loginUser, Long regionId) {
        scopeResolver.requireOwnable(loginUser, regionId);
    }

    // 입구/출구로 지정하려는 카메라가 실제로 이 지하차도 소속인지 확인 (다른 지하차도 카메라를 잘못 지정하는 것 방지)
    private void requireCameraOfThisUnderpass(Long underpassId, Long cameraId) {
        Camera camera = cameraRepository.findByIdAndDeletedFalse(cameraId).orElse(null);
        if (camera == null || !camera.getUnderpassId().equals(underpassId)) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "이 지하차도에 속한 카메라가 아닙니다. cameraId=" + cameraId);
        }
    }

    // 저장 직후 DB에 실제로 저장된 값으로 다시 읽는다 (DECIMAL 자릿수 등을 예전 응답과 똑같이 맞추기 위함:
    // 요청의 35.15 가 DB 에선 35.1500000 으로 저장되고, 예전에도 그 값을 응답했다)
    private <T> T reload(T entity) {
        em.flush();
        em.refresh(entity);
        return entity;
    }

    // 차단/해제 이벤트 기록 (operatorId 필수, 위험도 값은 비움)
    private UnderpassEvent saveOperatorEvent(Long underpassId, UnderpassEventType type, Long operatorId) {
        UnderpassEvent event = new UnderpassEvent();
        event.setUnderpassId(underpassId);
        event.setEventType(type);
        event.setOperatorId(operatorId);
        return eventRepository.saveAndFlush(event);
    }

    private static java.time.LocalDateTime toLocalDateTime(Object value) {
        return (value instanceof java.sql.Timestamp ts) ? ts.toLocalDateTime() : (java.time.LocalDateTime) value;
    }

    private <T> List<T> top(QueryConditions c, String select, String orderBy, Class<T> type, int max) {
        TypedQuery<T> q = em.createQuery(select + c.where() + orderBy, type);
        c.applyTo(q);
        return q.setMaxResults(max).getResultList();
    }

    private long count(QueryConditions c, String select) {
        TypedQuery<Long> q = em.createQuery(select + c.where(), Long.class);
        c.applyTo(q);
        return q.getSingleResult();
    }

    // row = [Underpass, 지역명, 최신 위험점수, 판별대기 건수, 잔류차량 건수]
    private UnderpassListItem toListItem(Object[] row) {
        Underpass u = (Underpass) row[0];
        UnderpassListItem item = new UnderpassListItem();
        item.setId(u.getId());
        item.setName(u.getName());
        item.setRegionId(u.getRegionId());
        item.setRegionName((String) row[1]);
        item.setRoadAddress(u.getRoadAddress());
        item.setLatitude(u.getLatitude());
        item.setLongitude(u.getLongitude());
        item.setCurrentStatus(u.getCurrentStatus());
        item.setCurrentRiskLevel(u.getCurrentRiskLevel());
        item.setRiskScore((BigDecimal) row[2]);
        item.setFloodHistoryCount(u.getFloodHistoryCount());
        item.setCreatedAt(u.getCreatedAt());
        item.setPendingReviewCount(((Number) row[3]).longValue());
        item.setRemainingCount(((Number) row[4]).longValue());
        return item;
    }

    static UnderpassDetailResponse toDetail(Underpass u) {
        UnderpassDetailResponse d = new UnderpassDetailResponse();
        d.setId(u.getId());
        d.setName(u.getName());
        d.setRegionId(u.getRegionId());
        d.setRoadAddress(u.getRoadAddress());
        d.setLatitude(u.getLatitude());
        d.setLongitude(u.getLongitude());
        d.setHeightM(u.getHeightM());
        d.setLengthM(u.getLengthM());
        d.setFloodHistoryCount(u.getFloodHistoryCount());
        d.setCurrentStatus(u.getCurrentStatus());
        d.setCurrentBlockEventId(u.getCurrentBlockEventId());
        d.setCurrentRiskLevel(u.getCurrentRiskLevel());
        d.setWidthM(u.getWidthM());
        d.setWaterDistM(u.getWaterDistM());
        d.setCurrentRiskScore(u.getCurrentRiskScore());
        d.setUpEntryCameraId(u.getUpEntryCameraId());
        d.setUpExitCameraId(u.getUpExitCameraId());
        d.setDownEntryCameraId(u.getDownEntryCameraId());
        d.setDownExitCameraId(u.getDownExitCameraId());
        d.setCreatedAt(u.getCreatedAt());
        return d;
    }

    static RiskScoreTrendItem toTrendItem(RiskScore rs) {
        RiskScoreTrendItem item = new RiskScoreTrendItem();
        item.setRiskScore(rs.getRiskScore());
        item.setRainfallMm(rs.getRainfallMm());
        item.setRainfall1hMm(rs.getRainfall1hMm());
        item.setRainfall3hMm(rs.getRainfall3hMm());
        item.setRainfall6hMm(rs.getRainfall6hMm());
        item.setRainfall12hMm(rs.getRainfall12hMm());
        item.setRainfall24hMm(rs.getRainfall24hMm());
        item.setPredictedAt(rs.getPredictedAt());
        return item;
    }
}
