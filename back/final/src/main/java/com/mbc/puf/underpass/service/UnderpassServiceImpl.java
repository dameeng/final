package com.mbc.puf.underpass.service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mbc.puf.common.enums.TransitStatus;
import com.mbc.puf.common.enums.UnderpassCurrentStatus;
import com.mbc.puf.common.enums.UnderpassEventType;
import com.mbc.puf.common.exception.BusinessException;
import com.mbc.puf.common.request.PageParams;
import com.mbc.puf.common.response.PageResponse;
import com.mbc.puf.common.security.LoginUser;
import com.mbc.puf.common.util.LikePattern;
import com.mbc.puf.internal.dao.RiskScoreDao;
import com.mbc.puf.internal.dto.RiskScoreTrendItem;
import com.mbc.puf.threshold.service.ThresholdService;
import com.mbc.puf.underpass.dao.CameraDao;
import com.mbc.puf.underpass.dao.DisplayLogDao;
import com.mbc.puf.underpass.dao.UnderpassDao;
import com.mbc.puf.underpass.dao.UnderpassEventDao;
import com.mbc.puf.underpass.dao.UnderpassTransitDao;
import com.mbc.puf.underpass.dto.Camera;
import com.mbc.puf.underpass.dto.CameraAssignRequest;
import com.mbc.puf.underpass.dto.ControlHistoryItem;
import com.mbc.puf.underpass.dto.DisplayLog;
import com.mbc.puf.underpass.dto.DisplayLogRequest;
import com.mbc.puf.underpass.dto.TransitHistoryItem;
import com.mbc.puf.underpass.dto.TransitResponse;
import com.mbc.puf.underpass.dto.Underpass;
import com.mbc.puf.underpass.dto.UnderpassCreateRequest;
import com.mbc.puf.underpass.dto.UnderpassDetailResponse;
import com.mbc.puf.underpass.dto.UnderpassEvent;
import com.mbc.puf.underpass.dto.UnderpassListItem;
import com.mbc.puf.underpass.dto.UnderpassSearchCondition;
import com.mbc.puf.underpass.dto.UnderpassUpdateRequest;

@Service
public class UnderpassServiceImpl implements UnderpassService {

    private static final String REGIONAL_ADMIN = "REGIONAL_ADMIN";

    // hours 없이 limit만 쓸 때의 기본 개수(기존 동작과 동일)
    private static final int DEFAULT_RISK_SCORE_LIMIT = 24;
    // hours를 쓰는데 limit을 안 줬을 때의 안전 상한. 스케줄러가 60초마다 지하차도당 1건씩 쌓는 구조라
    // 하루(24시간)치를 다 받아도 1440건 남짓 — 넉넉하게 3000으로 잡아둔다
    private static final int HOURS_SAFETY_LIMIT = 3000;

    // 잔류/장시간 IN_TRANSIT 차량을 자동으로 "통과완료" 처리하기까지 기다리는 시간(분). 2026-10-01 확정값
    private static final int AUTO_EXIT_MINUTES = 2;

    private final UnderpassDao underpassDao;
    private final UnderpassEventDao underpassEventDao;
    private final UnderpassTransitDao underpassTransitDao;
    private final DisplayLogDao displayLogDao;
    private final CameraDao cameraDao;
    private final ThresholdService thresholdService;
    private final RiskScoreDao riskScoreDao;

    public UnderpassServiceImpl(UnderpassDao underpassDao, UnderpassEventDao underpassEventDao,
                                 UnderpassTransitDao underpassTransitDao, DisplayLogDao displayLogDao,
                                 CameraDao cameraDao, ThresholdService thresholdService,
                                 RiskScoreDao riskScoreDao) {
        this.underpassDao = underpassDao;
        this.underpassEventDao = underpassEventDao;
        this.underpassTransitDao = underpassTransitDao;
        this.displayLogDao = displayLogDao;
        this.cameraDao = cameraDao;
        this.thresholdService = thresholdService;
        this.riskScoreDao = riskScoreDao;
    }

    // ---- 조회: 관리자면 지역 상관없이 전부 열람 가능 ----

    @Override
    @Transactional(readOnly = true)
    public PageResponse<UnderpassListItem> getUnderpassList(LoginUser loginUser, Long regionId, String keyword,
                                                             int page, int size) {
        PageParams pageParams = PageParams.of(page, size);

        // regionId는 선택 파라미터: 안 주면(null) 전체 지역 대상으로 조회한다 (CP-05~07 공개 조회)
        UnderpassSearchCondition condition = new UnderpassSearchCondition();
        condition.setRegionId(regionId);
        condition.setKeyword(LikePattern.of(keyword));
        condition.setSize(pageParams.getSize());
        condition.setOffset(pageParams.getOffset());

        long total = underpassDao.countUnderpassList(condition);
        List<UnderpassListItem> items = (total == 0) ? List.of() : underpassDao.selectUnderpassList(condition);

        return new PageResponse<>(items, pageParams.getPage(), pageParams.getSize(), total);
    }

    @Override
    @Transactional(readOnly = true)
    public UnderpassDetailResponse getUnderpass(LoginUser loginUser, Long id) {
        return requireExistingUnderpass(id);
    }

    @Override
    @Transactional(readOnly = true)
    public List<RiskScoreTrendItem> getRiskScoreTrend(Long id, Integer limit, Integer hours) {
        requireExistingUnderpass(id);   // 존재하지 않으면 404
        int effectiveLimit = limit != null ? limit : (hours != null ? HOURS_SAFETY_LIMIT : DEFAULT_RISK_SCORE_LIMIT);
        List<RiskScoreTrendItem> recent = riskScoreDao.selectRecentRiskScores(id, effectiveLimit, hours);
        Collections.reverse(recent);   // DB에서는 최신순으로 가져왔으니, 그래프용으로 시간 오름차순으로 뒤집는다
        return recent;
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
        underpass.setFloodHistoryCount(request.getFloodHistoryCount());
        underpass.setCurrentStatus(UnderpassCurrentStatus.NORMAL);   // 등록 시 항상 정상 상태로 고정

        underpassDao.insertUnderpass(underpass);   // 생성된 id가 underpass.id 에 채워진다
        thresholdService.createDefaultThresholds(underpass.getId(), loginUser.id());   // SAFE/WARNING/DANGER 3행 기본 생성

        return requireExistingUnderpass(underpass.getId());
    }

    @Override
    @Transactional
    public UnderpassDetailResponse updateUnderpass(LoginUser loginUser, Long id, UnderpassUpdateRequest request) {
        UnderpassDetailResponse existing = requireExistingUnderpass(id);
        requireOwnableRegion(loginUser, existing.getRegionId());       // 지금 속한 지역이 본인 담당인지
        requireOwnableRegion(loginUser, request.getRegionId());        // 옮기려는 지역도 본인 담당인지

        Underpass underpass = new Underpass();
        underpass.setId(id);
        underpass.setName(request.getName().trim());
        underpass.setRegionId(request.getRegionId());
        underpass.setRoadAddress(request.getRoadAddress());
        underpass.setLatitude(request.getLatitude());
        underpass.setLongitude(request.getLongitude());
        underpass.setHeightM(request.getHeightM());
        underpass.setLengthM(request.getLengthM());
        underpass.setFloodHistoryCount(request.getFloodHistoryCount());

        underpassDao.updateUnderpass(underpass);

        return requireExistingUnderpass(id);
    }

    @Override
    @Transactional
    public void deleteUnderpass(LoginUser loginUser, Long id) {
        UnderpassDetailResponse existing = requireExistingUnderpass(id);
        requireOwnableRegion(loginUser, existing.getRegionId());
        underpassDao.softDeleteUnderpass(id);
    }

    // ---- 차단/해제 (MP-10): REGIONAL_ADMIN은 본인 담당 지역만 ----

    @Override
    @Transactional
    public UnderpassDetailResponse blockUnderpass(LoginUser loginUser, Long id) {
        UnderpassDetailResponse existing = requireExistingUnderpass(id);
        requireOwnableRegion(loginUser, existing.getRegionId());

        if (existing.getCurrentStatus() == UnderpassCurrentStatus.BLOCKED) {
            throw new BusinessException(HttpStatus.CONFLICT, "이미 차단된 지하차도입니다.");
        }

        UnderpassEvent event = new UnderpassEvent();
        event.setUnderpassId(id);
        event.setEventType(UnderpassEventType.BLOCK);
        event.setOperatorId(loginUser.id());
        underpassEventDao.insertUnderpassEvent(event);   // 생성된 id가 event.id 에 채워진다

        underpassDao.updateCurrentStatus(id, UnderpassCurrentStatus.BLOCKED, event.getId());
        underpassTransitDao.markTransitRemaining(id);   // 차단 시점에 안에 있던(IN_TRANSIT) 차량을 REMAINING으로 일괄 처리

        return requireExistingUnderpass(id);
    }

    @Override
    @Transactional
    public UnderpassDetailResponse releaseUnderpass(LoginUser loginUser, Long id) {
        UnderpassDetailResponse existing = requireExistingUnderpass(id);
        requireOwnableRegion(loginUser, existing.getRegionId());

        if (existing.getCurrentStatus() == UnderpassCurrentStatus.NORMAL) {
            throw new BusinessException(HttpStatus.CONFLICT, "이미 정상 상태인 지하차도입니다.");
        }

        UnderpassEvent event = new UnderpassEvent();
        event.setUnderpassId(id);
        event.setEventType(UnderpassEventType.RELEASE);
        event.setOperatorId(loginUser.id());
        underpassEventDao.insertUnderpassEvent(event);

        underpassDao.updateCurrentStatus(id, UnderpassCurrentStatus.NORMAL, null);   // 해제되면 current_block_event_id도 비운다

        return requireExistingUnderpass(id);
    }

    // ---- 입구/출구 카메라 지정: REGIONAL_ADMIN은 본인 담당 지역만 ----

    @Override
    @Transactional
    public UnderpassDetailResponse assignEntryCamera(LoginUser loginUser, Long id, CameraAssignRequest request) {
        UnderpassDetailResponse existing = requireExistingUnderpass(id);
        requireOwnableRegion(loginUser, existing.getRegionId());
        requireCameraOfThisUnderpass(id, request.getCameraId());

        underpassDao.assignEntryCamera(id, request.getCameraId());
        return requireExistingUnderpass(id);
    }

    @Override
    @Transactional
    public UnderpassDetailResponse assignExitCamera(LoginUser loginUser, Long id, CameraAssignRequest request) {
        UnderpassDetailResponse existing = requireExistingUnderpass(id);
        requireOwnableRegion(loginUser, existing.getRegionId());
        requireCameraOfThisUnderpass(id, request.getCameraId());

        underpassDao.assignExitCamera(id, request.getCameraId());
        return requireExistingUnderpass(id);
    }

    // ---- 잔류차량 등 통과 기록 / 제어이력 조회: 관리자면 지역 상관없이 조회 가능 ----

    @Override
    @Transactional(readOnly = true)
    public List<TransitResponse> getTransits(LoginUser loginUser, Long id, TransitStatus status) {
        requireExistingUnderpass(id);
        return underpassTransitDao.selectTransitsByUnderpassId(id, status);
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<TransitHistoryItem> getTransitHistory(LoginUser loginUser, Long underpassId,
                                                               TransitStatus status, String keyword,
                                                               LocalDate startDate, LocalDate endDate,
                                                               int page, int size) {
        if (underpassId != null) {
            requireExistingUnderpass(underpassId);   // 존재하지 않는 시설이면 404
        }
        // SUPER_ADMIN은 전체(null), REGIONAL_ADMIN은 본인 담당 지역 시설의 기록만
        // (다른 지역 시설 underpassId를 직접 줘도 이 조건 때문에 결과가 비어 있게 된다)
        Long regionId = REGIONAL_ADMIN.equals(loginUser.role()) ? loginUser.regionId() : null;
        PageParams pageParams = PageParams.of(page, size);

        // endDate는 "그날까지 포함"이 되도록 다음날 00:00을 배타적 상한으로 사용
        LocalDateTime startAt = (startDate == null) ? null : startDate.atStartOfDay();
        LocalDateTime endAt = (endDate == null) ? null : endDate.plusDays(1).atStartOfDay();
        LikePattern pattern = LikePattern.ofCar(keyword);
        String carNumPattern = (pattern == null) ? null : pattern.getContains();

        long total = underpassTransitDao.countTransitHistory(underpassId, regionId, status, startAt, endAt,
                carNumPattern);
        List<TransitHistoryItem> items = (total == 0) ? List.of()
                : underpassTransitDao.selectTransitHistory(underpassId, regionId, status, startAt, endAt,
                        carNumPattern, pageParams.getSize(), pageParams.getOffset());

        return new PageResponse<>(items, pageParams.getPage(), pageParams.getSize(), total);
    }

    @Override
    @Transactional(readOnly = true)
    public List<ControlHistoryItem> getControlHistory(LoginUser loginUser, Long id, String kind,
                                                       LocalDate startDate, LocalDate endDate) {
        requireExistingUnderpass(id);
        LocalDateTime startAt = (startDate == null) ? null : startDate.atStartOfDay();
        LocalDateTime endAt = (endDate == null) ? null : endDate.plusDays(1).atStartOfDay();
        return underpassEventDao.selectControlHistory(id, kind, startAt, endAt);
    }

    // ---- 전광판 조작: REGIONAL_ADMIN은 본인 담당 지역만. 실제 장치 제어는 없고 기록만 남긴다 ----

    @Override
    @Transactional
    public void postDisplayLog(LoginUser loginUser, Long id, DisplayLogRequest request) {
        UnderpassDetailResponse existing = requireExistingUnderpass(id);
        requireOwnableRegion(loginUser, existing.getRegionId());

        DisplayLog displayLog = new DisplayLog();
        displayLog.setUnderpassId(id);
        displayLog.setMessageType(request.getMessageType());
        displayLog.setOperatorId(loginUser.id());
        displayLogDao.insertDisplayLog(displayLog);
    }

    // ---- 잔류/장시간 IN_TRANSIT 차량 자동 종료 (스케줄러 전용) ----

    @Override
    @Transactional
    public int expireStaleTransits() {
        return underpassTransitDao.expireStaleTransits(AUTO_EXIT_MINUTES);
    }

    // ---- 내부 메서드 ----

    // 삭제되지 않은 지하차도 상세 조회, 없으면 404 (지역 제한 없음 — 조회는 관리자 모두 허용)
    private UnderpassDetailResponse requireExistingUnderpass(Long id) {
        UnderpassDetailResponse underpass = underpassDao.selectUnderpassById(id);
        if (underpass == null) {
            throw new BusinessException(HttpStatus.NOT_FOUND, "존재하지 않는 지하차도입니다. id=" + id);
        }
        return underpass;
    }

    // REGIONAL_ADMIN이 자기 담당 지역이 아닌 regionId를 등록/수정/삭제 대상으로 쓰면 차단
    private void requireOwnableRegion(LoginUser loginUser, Long regionId) {
        if (REGIONAL_ADMIN.equals(loginUser.role()) && !loginUser.regionId().equals(regionId)) {
            throw new BusinessException(HttpStatus.FORBIDDEN, "담당 지역 외에는 등록·수정·삭제할 수 없습니다.");
        }
    }

    // 입구/출구로 지정하려는 카메라가 실제로 이 지하차도 소속인지 확인 (다른 지하차도 카메라를 잘못 지정하는 것 방지)
    private void requireCameraOfThisUnderpass(Long underpassId, Long cameraId) {
        Camera camera = cameraDao.selectCameraById(cameraId);
        if (camera == null || !camera.getUnderpassId().equals(underpassId)) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "이 지하차도에 속한 카메라가 아닙니다. cameraId=" + cameraId);
        }
    }
}