package com.mbc.puf.plate.service;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mbc.puf.alert.service.AlertService;
import com.mbc.puf.car.entity.Car;
import com.mbc.puf.car.repository.CarRepository;
import com.mbc.puf.common.enums.CameraRole;
import com.mbc.puf.common.enums.RecognitionStatus;
import com.mbc.puf.common.enums.ReviewStatus;
import com.mbc.puf.common.enums.RiskLevel;
import com.mbc.puf.common.enums.UnderpassCurrentStatus;
import com.mbc.puf.common.enums.UnderpassEventType;
import com.mbc.puf.common.exception.BusinessException;
import com.mbc.puf.common.util.CarNumber;
import com.mbc.puf.common.jpa.DbClock;
import com.mbc.puf.common.query.PagedQuery;
import com.mbc.puf.common.query.QueryConditions;
import com.mbc.puf.common.request.PageQuery;
import com.mbc.puf.common.request.PeriodQuery;
import com.mbc.puf.common.request.ScopeQuery;
import com.mbc.puf.common.request.VehicleQuery;
import com.mbc.puf.common.response.PageResponse;
import com.mbc.puf.common.security.LoginUser;
import com.mbc.puf.common.security.ScopeResolver;
import com.mbc.puf.plate.dto.PlateLogListItem;
import com.mbc.puf.plate.dto.PlateLogReviewRequest;
import com.mbc.puf.plate.dto.PlateLogReviewResponse;
import com.mbc.puf.plate.entity.PlateLog;
import com.mbc.puf.plate.repository.PlateLogRepository;
import com.mbc.puf.underpass.entity.Camera;
import com.mbc.puf.underpass.entity.Underpass;
import com.mbc.puf.underpass.repository.CameraRepository;
import com.mbc.puf.underpass.repository.UnderpassEventRepository;
import com.mbc.puf.underpass.repository.UnderpassRepository;

import jakarta.persistence.EntityManager;

@Service
public class PlateLogReviewServiceImpl implements PlateLogReviewService {


    private static final String FROM = " from PlateLog p join Camera c on c.id = p.cameraId"
            + " join Underpass u on u.id = c.underpassId";

    private final PlateLogRepository plateLogRepository;
    private final UnderpassRepository underpassRepository;
    private final UnderpassEventRepository eventRepository;
    private final CameraRepository cameraRepository;
    private final CarRepository carRepository;
    private final AlertService alertService;
    private final ScopeResolver scopeResolver;
    private final DbClock dbClock;
    private final EntityManager em;
    private final com.mbc.puf.stream.StreamPublisher streamPublisher;   // SSE 실시간 이벤트

    public PlateLogReviewServiceImpl(PlateLogRepository plateLogRepository, UnderpassRepository underpassRepository,
                                     UnderpassEventRepository eventRepository, CameraRepository cameraRepository,
                                     CarRepository carRepository, AlertService alertService,
                                     ScopeResolver scopeResolver, DbClock dbClock, EntityManager em,
                                     com.mbc.puf.stream.StreamPublisher streamPublisher) {
        this.plateLogRepository = plateLogRepository;
        this.underpassRepository = underpassRepository;
        this.eventRepository = eventRepository;
        this.cameraRepository = cameraRepository;
        this.carRepository = carRepository;
        this.alertService = alertService;
        this.scopeResolver = scopeResolver;
        this.dbClock = dbClock;
        this.em = em;
        this.streamPublisher = streamPublisher;
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<PlateLogListItem> getPlateLogs(LoginUser loginUser, ScopeQuery scope,
                                                       ReviewStatus reviewStatus, RecognitionStatus recognitionStatus,
                                                       VehicleQuery vehicle, PeriodQuery period, PageQuery page) {
        // REGIONAL_ADMIN은 본인 담당 지역 소속 지하차도만 (Scope 공통 규칙)
        ScopeQuery resolved = scopeResolver.resolve(loginUser, scope);
        QueryConditions c = new QueryConditions()
                .eqIfPresent("c.underpassId", resolved.getUnderpassId())
                .inIfPresent("u.regionId", resolved.getRegionIds())
                .eqIfPresent("p.reviewStatus", reviewStatus)
                .eqIfPresent("p.recognitionStatus", recognitionStatus)
                .carNumIfPresent(vehicle.getCarNum(), "p.detectedNum", "p.correctedNum")   // 인식값·정정값 둘 다
                .periodIfPresent("p.detectedAt", period);

        // 판별대기 목록은 마감 임박한 것부터, 그 외에는 최근 인식순
        String orderBy = (reviewStatus == ReviewStatus.PENDING)
                ? " order by p.reviewDeadline asc, p.id asc"
                : " order by p.detectedAt desc, p.id desc";

        return PagedQuery.fetch(em, "select p, c.underpassId, u.name" + FROM, "select count(p)" + FROM, c, orderBy,
                Object[].class, row -> {
                    PlateLog p = (PlateLog) row[0];
                    return new PlateLogListItem(p.getId(), p.getCameraId(), (Long) row[1], (String) row[2],
                            p.getDetectedNum(), p.getCorrectedNum(), p.getConfidence(), p.getImagePath(),
                            p.getRecognitionStatus(), p.getCarId(), p.getReviewStatus(), p.getReviewDeadline(),
                            p.getReviewedBy(), p.getReviewedAt(), p.getDetectedAt());
                }, page.toParams());
    }

    @Override
    @Transactional
    public PlateLogReviewResponse review(LoginUser loginUser, Long id, PlateLogReviewRequest request) {
        PlateLog plateLog = plateLogRepository.findById(id)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "존재하지 않는 인식 기록입니다. id=" + id));
        Camera camera = cameraRepository.findById(plateLog.getCameraId())
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "존재하지 않는 인식 기록입니다. id=" + id));

        Underpass underpass = underpassRepository.findByIdAndDeletedFalse(camera.getUnderpassId())
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND,
                        "존재하지 않는 지하차도입니다. id=" + camera.getUnderpassId()));
        scopeResolver.requireOwnable(loginUser, underpass.getRegionId());   // 담당 지역 밖이면 403

        String correctedNum = CarNumber.normalize(request.getCorrectedNum().trim());
        // 같은 번호를 등록한 고객이 여럿일 수 있다. car_id 에는 첫 번째 차량, 알림은 고객마다 1건
        List<Car> matchedCars = carRepository.findActiveByCarNum(correctedNum);
        Long carId = matchedCars.isEmpty() ? null : matchedCars.get(0).getId();

        var now = dbClock.now();
        plateLog.setCorrectedNum(correctedNum);
        plateLog.setCarId(carId);
        plateLog.setReviewStatus(ReviewStatus.CONFIRMED);
        plateLog.setReviewDeadline(null);
        plateLog.setReviewedBy(loginUser.id());
        plateLog.setReviewedAt(now);

        // 정정으로 새로 매칭된 차량이 있으면, 자동 판정 때와 같은 조건(camera_role 기준)일 때 새로 알림을 보낸다.
        // 원래 detected_num으로는 못 찾았던 차주에게 뒤늦게라도 알려주는 것
        // (카메라가 삭제된 상태면 알림은 건너뛴다 — 예전과 동일)
        if (carId != null && !camera.isDeleted()) {
            if (camera.getCameraRole() == CameraRole.APPROACH_LPR
                    && (underpass.getCurrentRiskLevel() == RiskLevel.WARNING
                        || underpass.getCurrentRiskLevel() == RiskLevel.DANGER)) {
                eventRepository.findFirstByUnderpassIdAndEventTypeOrderByCreatedAtDescIdDesc(underpass.getId(),
                                UnderpassEventType.RISK_LEVEL_UP)
                        .ifPresent(e -> matchedCars.forEach(
                                car -> alertService.sendPredictiveAlert(e.getId(), car.getId(), correctedNum)));
            } else if (camera.getCameraRole() == CameraRole.FINAL_LPR
                    && underpass.getCurrentStatus() == UnderpassCurrentStatus.BLOCKED
                    && underpass.getCurrentBlockEventId() != null) {
                for (Car car : matchedCars) {
                    alertService.sendRoiFinalAlert(underpass.getCurrentBlockEventId(), car.getId(), correctedNum);
                }
            }
        }

        // 대기열에서 빠졌음을 같은 지역 관리자 화면에 알린다
        streamPublisher.publishToAdmins(underpass.getRegionId(), "plate-queue-done",
                new com.mbc.puf.stream.StreamPayloads.PlateQueue(id, underpass.getId(), plateLog.getCameraId(),
                        plateLog.getDetectedNum(), plateLog.getConfidence(), ReviewStatus.CONFIRMED, null));

        return new PlateLogReviewResponse(id, correctedNum, carId, ReviewStatus.CONFIRMED, loginUser.id(), now);
    }

    @Override
    @Transactional
    public void autoProcessExpired() {
        var now = dbClock.now();
        // 처리 전에 대상(마감 지난 대기 건)을 먼저 읽어 두었다가, 처리 후 화면에 하나씩 알린다
        var expired = plateLogRepository.findExpiredPending(now);
        if (expired.isEmpty()) {
            return;
        }
        plateLogRepository.autoProcessExpired(now);
        for (Object[] row : expired) {
            streamPublisher.publishToAdmins((Long) row[2], "plate-queue-done",
                    new com.mbc.puf.stream.StreamPayloads.PlateQueue((Long) row[0], (Long) row[1], null, null, null,
                            ReviewStatus.AUTO_PROCESSED, null));
        }
    }
}