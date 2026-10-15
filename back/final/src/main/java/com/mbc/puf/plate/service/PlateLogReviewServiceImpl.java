package com.mbc.puf.plate.service;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mbc.puf.alert.service.AlertService;
import com.mbc.puf.car.dao.CarDao;
import com.mbc.puf.car.dto.Car;
import com.mbc.puf.common.enums.CameraRole;
import com.mbc.puf.common.enums.ReviewStatus;
import com.mbc.puf.common.enums.RiskLevel;
import com.mbc.puf.common.enums.UnderpassCurrentStatus;
import com.mbc.puf.common.exception.BusinessException;
import com.mbc.puf.common.security.LoginUser;
import com.mbc.puf.plate.dao.PlateLogReviewDao;
import com.mbc.puf.plate.dto.PlateLogPendingItem;
import com.mbc.puf.plate.dto.PlateLogReviewRequest;
import com.mbc.puf.plate.dto.PlateLogReviewResponse;
import com.mbc.puf.plate.dto.PlateLogRow;
import com.mbc.puf.underpass.dao.CameraDao;
import com.mbc.puf.underpass.dao.UnderpassDao;
import com.mbc.puf.underpass.dao.UnderpassEventDao;
import com.mbc.puf.underpass.dto.Camera;
import com.mbc.puf.underpass.dto.UnderpassDetailResponse;
import com.mbc.puf.underpass.dto.UnderpassEvent;

@Service
public class PlateLogReviewServiceImpl implements PlateLogReviewService {

    private static final String REGIONAL_ADMIN = "REGIONAL_ADMIN";

    private final PlateLogReviewDao plateLogReviewDao;
    private final UnderpassDao underpassDao;
    private final UnderpassEventDao underpassEventDao;
    private final CameraDao cameraDao;
    private final CarDao carDao;
    private final AlertService alertService;

    public PlateLogReviewServiceImpl(PlateLogReviewDao plateLogReviewDao, UnderpassDao underpassDao,
                                      UnderpassEventDao underpassEventDao, CameraDao cameraDao, CarDao carDao,
                                      AlertService alertService) {
        this.plateLogReviewDao = plateLogReviewDao;
        this.underpassDao = underpassDao;
        this.underpassEventDao = underpassEventDao;
        this.cameraDao = cameraDao;
        this.carDao = carDao;
        this.alertService = alertService;
    }

    @Override
    @Transactional(readOnly = true)
    public List<PlateLogPendingItem> getPendingList(LoginUser loginUser, Long underpassId) {
        // REGIONAL_ADMIN은 본인 담당 지역 소속 지하차도만, SUPER_ADMIN은 전체(null = 필터 없음).
        // underpassId는 둘 다에게 추가로 더 좁히는 선택 필터(대시보드 시설 선택용) — region 필터와
        // AND로 묶이므로 REGIONAL_ADMIN이 담당 외 지하차도 id를 넘겨도 결과가 비게 될 뿐 다른 지역이 새지 않는다
        Long regionId = REGIONAL_ADMIN.equals(loginUser.role()) ? loginUser.regionId() : null;
        return plateLogReviewDao.selectPendingList(regionId, underpassId);
    }

    @Override
    @Transactional
    public PlateLogReviewResponse review(LoginUser loginUser, Long id, PlateLogReviewRequest request) {
        PlateLogRow row = plateLogReviewDao.selectRowById(id);
        if (row == null) {
            throw new BusinessException(HttpStatus.NOT_FOUND, "존재하지 않는 인식 기록입니다. id=" + id);
        }

        UnderpassDetailResponse underpass = underpassDao.selectUnderpassById(row.getUnderpassId());
        if (underpass == null) {
            throw new BusinessException(HttpStatus.NOT_FOUND, "존재하지 않는 지하차도입니다. id=" + row.getUnderpassId());
        }
        if (REGIONAL_ADMIN.equals(loginUser.role()) && !loginUser.regionId().equals(underpass.getRegionId())) {
            throw new BusinessException(HttpStatus.FORBIDDEN, "담당 지역 외의 인식 기록은 판별할 수 없습니다.");
        }

        String correctedNum = request.getCorrectedNum().trim();
        Car matched = carDao.selectCarByCarNum(correctedNum);
        Long carId = (matched != null) ? matched.getId() : null;

        plateLogReviewDao.updateReview(id, correctedNum, carId, loginUser.id());

        // 정정으로 새로 매칭된 차량이 있으면, 자동 판정 때와 같은 조건(camera_role 기준)일 때 새로 알림을 보낸다.
        // 원래 detected_num으로는 못 찾았던 차주에게 뒤늦게라도 알려주는 것
        if (carId != null) {
            Camera camera = cameraDao.selectCameraById(row.getCameraId());
            if (camera != null && camera.getCameraRole() == CameraRole.APPROACH_LPR
                    && (underpass.getCurrentRiskLevel() == RiskLevel.WARNING
                        || underpass.getCurrentRiskLevel() == RiskLevel.DANGER)) {
                UnderpassEvent latestRiskUpEvent = underpassEventDao.selectLatestRiskLevelUpEvent(underpass.getId());
                if (latestRiskUpEvent != null) {
                    alertService.sendPredictiveAlert(latestRiskUpEvent.getId(), carId, correctedNum);
                }
            } else if (camera != null && camera.getCameraRole() == CameraRole.ROI_LPR
                    && underpass.getCurrentStatus() == UnderpassCurrentStatus.BLOCKED
                    && underpass.getCurrentBlockEventId() != null) {
                alertService.sendRoiFinalAlert(underpass.getCurrentBlockEventId(), carId, correctedNum);
            }
        }

        return new PlateLogReviewResponse(id, correctedNum, carId, ReviewStatus.CONFIRMED, loginUser.id(),
                LocalDateTime.now());
    }

    @Override
    @Transactional
    public void autoProcessExpired() {
        plateLogReviewDao.autoProcessExpired();
    }
}