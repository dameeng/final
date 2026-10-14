package com.mbc.project;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

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
import com.mbc.puf.plate.dto.PlateLogReviewRequest;
import com.mbc.puf.plate.dto.PlateLogReviewResponse;
import com.mbc.puf.plate.dto.PlateLogRow;
import com.mbc.puf.plate.service.PlateLogReviewServiceImpl;
import com.mbc.puf.underpass.dao.CameraDao;
import com.mbc.puf.underpass.dao.UnderpassDao;
import com.mbc.puf.underpass.dao.UnderpassEventDao;
import com.mbc.puf.underpass.dto.Camera;
import com.mbc.puf.underpass.dto.UnderpassDetailResponse;
import com.mbc.puf.underpass.dto.UnderpassEvent;

/**
 * 관리자 수동 판별 단위 테스트 (번호판 텍스트를 고쳐서 다시 매칭).
 * 대상: PlateLogReviewServiceImpl
 *  - 권한: 지역담당자는 담당 지역만, 최고관리자는 전체
 *  - 정정한 번호가 등록 차량과 매칭되면 카메라 역할에 따라 알림 발송
 */
@ExtendWith(MockitoExtension.class)
class PlateLogReviewServiceTest {

    private static final Long LOG_ID = 100L;
    private static final Long UNDERPASS_ID = 1L;
    private static final Long CAMERA_ID = 10L;
    private static final Long CAR_ID = 5L;
    private static final Long REGION_A = 11L;
    private static final Long REGION_B = 22L;
    private static final String NUM = "12가3456";

    @Mock private PlateLogReviewDao plateLogReviewDao;
    @Mock private UnderpassDao underpassDao;
    @Mock private UnderpassEventDao underpassEventDao;
    @Mock private CameraDao cameraDao;
    @Mock private CarDao carDao;
    @Mock private AlertService alertService;

    @InjectMocks
    private PlateLogReviewServiceImpl service;

    private final LoginUser superAdmin = new LoginUser(1L, "MANAGER", "SUPER_ADMIN", null);
    private final LoginUser regionalA = new LoginUser(2L, "MANAGER", "REGIONAL_ADMIN", REGION_A);

    private PlateLogReviewRequest reviewRequest(String num) {
        PlateLogReviewRequest r = new PlateLogReviewRequest();
        r.setCorrectedNum(num);
        return r;
    }

    private void givenRow() {
        PlateLogRow row = new PlateLogRow();
        row.setId(LOG_ID);
        row.setUnderpassId(UNDERPASS_ID);
        row.setCameraId(CAMERA_ID);
        when(plateLogReviewDao.selectRowById(LOG_ID)).thenReturn(row);
    }

    private void givenUnderpass(Long regionId, RiskLevel risk, UnderpassCurrentStatus status, Long blockEventId) {
        UnderpassDetailResponse u = new UnderpassDetailResponse();
        u.setId(UNDERPASS_ID);
        u.setRegionId(regionId);
        u.setCurrentRiskLevel(risk);
        u.setCurrentStatus(status);
        u.setCurrentBlockEventId(blockEventId);
        when(underpassDao.selectUnderpassById(UNDERPASS_ID)).thenReturn(u);
    }

    private void givenCamera(CameraRole role) {
        Camera c = new Camera();
        c.setId(CAMERA_ID);
        c.setCameraRole(role);
        when(cameraDao.selectCameraById(CAMERA_ID)).thenReturn(c);
    }

    private void givenCarRegistered() {
        Car car = new Car();
        car.setId(CAR_ID);
        when(carDao.selectCarByCarNum(NUM)).thenReturn(car);
    }

    // ---------- 목록 ----------

    @Test
    @DisplayName("판별 대기 목록: 지역담당자는 담당 지역으로 한정해서 조회한다")
    void pendingList_regionalAdmin_isLimitedToRegion() {
        service.getPendingList(regionalA, null);

        verify(plateLogReviewDao).selectPendingList(REGION_A, null);
    }

    @Test
    @DisplayName("판별 대기 목록: 최고관리자는 지역 제한 없이 조회한다")
    void pendingList_superAdmin_isNotLimited() {
        service.getPendingList(superAdmin, 3L);

        verify(plateLogReviewDao).selectPendingList(null, 3L);
    }

    // ---------- 수동 판별 ----------

    @Test
    @DisplayName("없는 인식 기록이면 404")
    void review_unknownLog_isNotFound() {
        when(plateLogReviewDao.selectRowById(LOG_ID)).thenReturn(null);

        BusinessException e = assertThrows(BusinessException.class,
                () -> service.review(superAdmin, LOG_ID, reviewRequest(NUM)));

        assertEquals(HttpStatus.NOT_FOUND, e.getStatus());
    }

    @Test
    @DisplayName("지역담당자가 다른 지역의 인식 기록을 판별하면 403이고 아무것도 저장하지 않는다")
    void review_otherRegion_isForbidden() {
        givenRow();
        givenUnderpass(REGION_B, RiskLevel.SAFE, UnderpassCurrentStatus.NORMAL, null);

        BusinessException e = assertThrows(BusinessException.class,
                () -> service.review(regionalA, LOG_ID, reviewRequest(NUM)));

        assertEquals(HttpStatus.FORBIDDEN, e.getStatus());
        verify(plateLogReviewDao, never()).updateReview(anyLong(), anyString(), org.mockito.ArgumentMatchers.any(),
                anyLong());
    }

    @Test
    @DisplayName("최고관리자는 어느 지역이든 판별할 수 있다")
    void review_superAdmin_canReviewAnyRegion() {
        givenRow();
        givenUnderpass(REGION_B, RiskLevel.SAFE, UnderpassCurrentStatus.NORMAL, null);
        givenCamera(CameraRole.CCTV);
        givenCarRegistered();

        PlateLogReviewResponse response = service.review(superAdmin, LOG_ID, reviewRequest(NUM));

        assertEquals(ReviewStatus.CONFIRMED, response.getReviewStatus());
        assertEquals(CAR_ID, response.getCarId());
    }

    @Test
    @DisplayName("지역담당자는 담당 지역의 기록을 판별할 수 있고, 입력한 번호의 앞뒤 공백은 제거된다")
    void review_ownRegion_trimsCorrectedNum() {
        givenRow();
        givenUnderpass(REGION_A, RiskLevel.SAFE, UnderpassCurrentStatus.NORMAL, null);
        when(carDao.selectCarByCarNum(NUM)).thenReturn(null);

        PlateLogReviewResponse response = service.review(regionalA, LOG_ID, reviewRequest("  " + NUM + "  "));

        assertEquals(NUM, response.getCorrectedNum());
        verify(plateLogReviewDao).updateReview(LOG_ID, NUM, null, 2L);
    }

    @Test
    @DisplayName("정정한 번호가 등록 차량과 안 맞으면 알림 없이 확정만 된다 (carId 없음)")
    void review_noMatchingCar_noAlert() {
        givenRow();
        givenUnderpass(REGION_A, RiskLevel.DANGER, UnderpassCurrentStatus.BLOCKED, 99L);
        when(carDao.selectCarByCarNum(NUM)).thenReturn(null);

        PlateLogReviewResponse response = service.review(regionalA, LOG_ID, reviewRequest(NUM));

        assertNull(response.getCarId());
        assertEquals(ReviewStatus.CONFIRMED, response.getReviewStatus());
        verify(alertService, never()).sendPredictiveAlert(anyLong(), anyLong(), anyString());
        verify(alertService, never()).sendRoiFinalAlert(anyLong(), anyLong(), anyString());
    }

    @Test
    @DisplayName("접근 카메라 기록을 정정해서 매칭되고 위험도가 경고 이상이면 사전예측 알림이 나간다")
    void review_approachCamera_sendsPredictiveAlert() {
        givenRow();
        givenUnderpass(REGION_A, RiskLevel.WARNING, UnderpassCurrentStatus.NORMAL, null);
        givenCamera(CameraRole.APPROACH_LPR);
        givenCarRegistered();
        UnderpassEvent riseEvent = new UnderpassEvent();
        riseEvent.setId(77L);
        when(underpassEventDao.selectLatestRiskLevelUpEvent(UNDERPASS_ID)).thenReturn(riseEvent);

        service.review(regionalA, LOG_ID, reviewRequest(NUM));

        verify(alertService).sendPredictiveAlert(77L, CAR_ID, NUM);
    }

    @Test
    @DisplayName("ROI 카메라 기록을 정정해서 매칭되고 차단 중이면 최후확인 알림이 나간다")
    void review_roiCamera_sendsFinalAlert() {
        givenRow();
        givenUnderpass(REGION_A, RiskLevel.DANGER, UnderpassCurrentStatus.BLOCKED, 99L);
        givenCamera(CameraRole.ROI_LPR);
        givenCarRegistered();

        service.review(regionalA, LOG_ID, reviewRequest(NUM));

        verify(alertService).sendRoiFinalAlert(99L, CAR_ID, NUM);
    }

    @Test
    @DisplayName("ROI 카메라 기록이라도 차단 중이 아니면 알림은 나가지 않는다")
    void review_roiCamera_notBlocked_noAlert() {
        givenRow();
        givenUnderpass(REGION_A, RiskLevel.DANGER, UnderpassCurrentStatus.NORMAL, null);
        givenCamera(CameraRole.ROI_LPR);
        givenCarRegistered();

        service.review(regionalA, LOG_ID, reviewRequest(NUM));

        verify(alertService, never()).sendRoiFinalAlert(anyLong(), anyLong(), anyString());
    }

    // ---------- 자동 처리 ----------

    @Test
    @DisplayName("1분 지난 판별 대기 건은 자동 처리 쿼리를 호출한다")
    void autoProcessExpired_delegatesToDao() {
        service.autoProcessExpired();

        verify(plateLogReviewDao).autoProcessExpired();
    }
}
