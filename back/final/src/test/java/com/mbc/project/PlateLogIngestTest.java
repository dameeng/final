package com.mbc.project;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

import com.mbc.puf.alert.service.AlertService;
import com.mbc.puf.car.dao.CarDao;
import com.mbc.puf.car.dto.Car;
import com.mbc.puf.common.enums.CameraRole;
import com.mbc.puf.common.enums.RecognitionStatus;
import com.mbc.puf.common.enums.ReviewStatus;
import com.mbc.puf.common.enums.RiskLevel;
import com.mbc.puf.common.enums.TransitStatus;
import com.mbc.puf.common.enums.UnderpassCurrentStatus;
import com.mbc.puf.common.exception.BusinessException;
import com.mbc.puf.internal.dao.PlateLogDao;
import com.mbc.puf.internal.dao.RiskScoreDao;
import com.mbc.puf.internal.dto.PlateLog;
import com.mbc.puf.internal.dto.PlateLogCreateRequest;
import com.mbc.puf.internal.dto.PlateLogResponse;
import com.mbc.puf.internal.service.InternalIngestServiceImpl;
import com.mbc.puf.threshold.dao.ThresholdDao;
import com.mbc.puf.underpass.dao.CameraDao;
import com.mbc.puf.underpass.dao.UnderpassDao;
import com.mbc.puf.underpass.dao.UnderpassEventDao;
import com.mbc.puf.underpass.dao.UnderpassTransitDao;
import com.mbc.puf.underpass.dto.Camera;
import com.mbc.puf.underpass.dto.UnderpassDetailResponse;
import com.mbc.puf.underpass.dto.UnderpassEvent;
import com.mbc.puf.underpass.dto.UnderpassTransit;

/**
 * 번호판 인식 결과 처리 단위 테스트.
 * 대상: InternalIngestServiceImpl.receivePlateLog
 *  - 인식 상태 판정(SUCCESS / LOW_CONFIDENCE / FAIL / UNMATCHED)
 *  - 판별 대기(PENDING) 여부
 *  - 카메라 역할에 따른 알림 발송 (사전예측 / 진입직전 최후확인)
 *  - 입구·출구 카메라의 통과 기록
 */
@ExtendWith(MockitoExtension.class)
class PlateLogIngestTest {

    private static final Long CAMERA_ID = 10L;
    private static final Long UNDERPASS_ID = 1L;
    private static final Long CAR_ID = 5L;
    private static final String CAR_NUM = "12가3456";
    private static final LocalDateTime DETECTED_AT = LocalDateTime.of(2026, 10, 3, 12, 0, 0);

    @Mock private PlateLogDao plateLogDao;
    @Mock private UnderpassDao underpassDao;
    @Mock private UnderpassEventDao underpassEventDao;
    @Mock private UnderpassTransitDao underpassTransitDao;
    @Mock private CameraDao cameraDao;
    @Mock private CarDao carDao;
    @Mock private AlertService alertService;
    // 이 테스트에서 직접 쓰지 않지만 서비스 생성자에 필요한 의존성
    @Mock private RiskScoreDao riskScoreDao;
    @Mock private ThresholdDao thresholdDao;

    @InjectMocks
    private InternalIngestServiceImpl service;

    // ---------- 준비용 도우미 ----------

    private PlateLogCreateRequest request(String num, String confidence) {
        PlateLogCreateRequest r = new PlateLogCreateRequest();
        r.setCameraId(CAMERA_ID);
        r.setDetectedNum(num);
        r.setConfidence(confidence == null ? null : new BigDecimal(confidence));
        r.setDetectedAt(DETECTED_AT);
        return r;
    }

    private Camera camera(CameraRole role) {
        Camera c = new Camera();
        c.setId(CAMERA_ID);
        c.setUnderpassId(UNDERPASS_ID);
        c.setCameraRole(role);
        return c;
    }

    private UnderpassDetailResponse underpass(RiskLevel risk, UnderpassCurrentStatus status, Long blockEventId) {
        UnderpassDetailResponse u = new UnderpassDetailResponse();
        u.setId(UNDERPASS_ID);
        u.setCurrentRiskLevel(risk);
        u.setCurrentStatus(status);
        u.setCurrentBlockEventId(blockEventId);
        return u;
    }

    private void givenCamera(CameraRole role) {
        when(cameraDao.selectCameraById(CAMERA_ID)).thenReturn(camera(role));
    }

    private void givenRegisteredCar() {
        Car car = new Car();
        car.setId(CAR_ID);
        when(carDao.selectCarByCarNum(CAR_NUM)).thenReturn(car);
    }

    private void givenUnderpass(UnderpassDetailResponse u) {
        when(underpassDao.selectUnderpassById(UNDERPASS_ID)).thenReturn(u);
    }

    private PlateLog savedPlateLog() {
        ArgumentCaptor<PlateLog> captor = ArgumentCaptor.forClass(PlateLog.class);
        verify(plateLogDao).insertPlateLog(captor.capture());
        return captor.getValue();
    }

    // ---------- 1. 인식 상태 판정 ----------

    @Test
    @DisplayName("존재하지 않는 카메라면 400")
    void unknownCamera_isRejected() {
        when(cameraDao.selectCameraById(CAMERA_ID)).thenReturn(null);

        BusinessException e = assertThrows(BusinessException.class,
                () -> service.receivePlateLog(request(CAR_NUM, "0.999"), null));

        assertEquals(HttpStatus.BAD_REQUEST, e.getStatus());
        verify(plateLogDao, never()).insertPlateLog(any(PlateLog.class));
    }

    @Test
    @DisplayName("등록 차량 + 신뢰도 높음 → SUCCESS, 판별 대기 없음")
    void registeredCar_highConfidence_isSuccess() {
        givenCamera(CameraRole.CCTV);
        givenRegisteredCar();

        PlateLogResponse response = service.receivePlateLog(request(CAR_NUM, "0.999"), null);

        PlateLog saved = savedPlateLog();
        assertEquals(RecognitionStatus.SUCCESS, saved.getRecognitionStatus());
        assertEquals(ReviewStatus.NONE, saved.getReviewStatus());
        assertNull(saved.getReviewDeadline());
        assertEquals(CAR_ID, saved.getCarId());
        assertEquals(RecognitionStatus.SUCCESS, response.getRecognitionStatus());
    }

    @Test
    @DisplayName("신뢰도 경계값(기준 0.600): 0.599는 LOW_CONFIDENCE + 판별 대기, 0.600은 SUCCESS + 대기 없음")
    void confidenceBoundary() {
        givenCamera(CameraRole.CCTV);
        givenRegisteredCar();

        service.receivePlateLog(request(CAR_NUM, "0.599"), null);
        service.receivePlateLog(request(CAR_NUM, "0.600"), null);

        ArgumentCaptor<PlateLog> captor = ArgumentCaptor.forClass(PlateLog.class);
        verify(plateLogDao, org.mockito.Mockito.times(2)).insertPlateLog(captor.capture());
        PlateLog below = captor.getAllValues().get(0);
        PlateLog atBoundary = captor.getAllValues().get(1);
        assertEquals(RecognitionStatus.LOW_CONFIDENCE, below.getRecognitionStatus());
        assertEquals(ReviewStatus.PENDING, below.getReviewStatus());
        assertEquals(RecognitionStatus.SUCCESS, atBoundary.getRecognitionStatus());
        assertEquals(ReviewStatus.NONE, atBoundary.getReviewStatus());
    }

    @Test
    @DisplayName("LOW_CONFIDENCE는 판별 대기(PENDING)가 되고 마감은 인식 시각 + 1분")
    void lowConfidence_isPendingWithOneMinuteDeadline() {
        givenCamera(CameraRole.CCTV);
        givenRegisteredCar();

        service.receivePlateLog(request(CAR_NUM, "0.500"), null);

        PlateLog saved = savedPlateLog();
        assertEquals(RecognitionStatus.LOW_CONFIDENCE, saved.getRecognitionStatus());
        assertEquals(ReviewStatus.PENDING, saved.getReviewStatus());
        assertEquals(DETECTED_AT.plusMinutes(1), saved.getReviewDeadline());
    }

    @Test
    @DisplayName("등록 차량이 아니고 신뢰도가 충분하면 UNMATCHED이고 판별 대기에는 걸리지 않는다")
    void unregisteredCar_highConfidence_isUnmatchedWithoutReview() {
        givenCamera(CameraRole.CCTV);
        when(carDao.selectCarByCarNum(CAR_NUM)).thenReturn(null);

        service.receivePlateLog(request(CAR_NUM, "0.999"), null);

        PlateLog saved = savedPlateLog();
        assertEquals(RecognitionStatus.UNMATCHED, saved.getRecognitionStatus());
        assertNull(saved.getCarId());
        assertEquals(ReviewStatus.NONE, saved.getReviewStatus());
    }

    @Test
    @DisplayName("등록 차량이 아니어도 신뢰도가 기준 미만이면 판별 대기에 걸린다 (인식 상태 값은 UNMATCHED 그대로)")
    void unregisteredCar_lowConfidence_isPendingButStillUnmatched() {
        givenCamera(CameraRole.CCTV);
        when(carDao.selectCarByCarNum(CAR_NUM)).thenReturn(null);

        service.receivePlateLog(request(CAR_NUM, "0.500"), null);

        PlateLog saved = savedPlateLog();
        assertEquals(RecognitionStatus.UNMATCHED, saved.getRecognitionStatus());
        assertEquals(ReviewStatus.PENDING, saved.getReviewStatus());
        assertEquals(DETECTED_AT.plusMinutes(1), saved.getReviewDeadline());
    }

    @Test
    @DisplayName("OCR이 번호를 못 읽으면(null) FAIL, 저장 번호는 FAILED")
    void unreadable_isFail() {
        givenCamera(CameraRole.CCTV);

        service.receivePlateLog(request(null, null), null);

        PlateLog saved = savedPlateLog();
        assertEquals(RecognitionStatus.FAIL, saved.getRecognitionStatus());
        assertEquals("FAILED", saved.getDetectedNum());
        assertNull(saved.getCarId());
        assertEquals(ReviewStatus.NONE, saved.getReviewStatus());   // OCR 실패(FAIL)는 판별 대기에 걸지 않는다
        verify(carDao, never()).selectCarByCarNum(anyString());
    }

    // ---------- 2. 알림 발송 (카메라 역할 기준) ----------

    @Test
    @DisplayName("접근 카메라 + 매칭 + 위험도 경고 → 사전예측 알림 발송")
    void approachCamera_warning_sendsPredictiveAlert() {
        givenCamera(CameraRole.APPROACH_LPR);
        givenRegisteredCar();
        givenUnderpass(underpass(RiskLevel.WARNING, UnderpassCurrentStatus.NORMAL, null));
        UnderpassEvent riseEvent = new UnderpassEvent();
        riseEvent.setId(77L);
        when(underpassEventDao.selectLatestRiskLevelUpEvent(UNDERPASS_ID)).thenReturn(riseEvent);

        service.receivePlateLog(request(CAR_NUM, "0.999"), null);

        verify(alertService).sendPredictiveAlert(77L, CAR_ID, CAR_NUM);
        verify(alertService, never()).sendRoiFinalAlert(anyLong(), anyLong(), anyString());
    }

    @Test
    @DisplayName("접근 카메라 + 매칭이어도 위험도가 안전이면 알림 없음")
    void approachCamera_safe_noAlert() {
        givenCamera(CameraRole.APPROACH_LPR);
        givenRegisteredCar();
        givenUnderpass(underpass(RiskLevel.SAFE, UnderpassCurrentStatus.NORMAL, null));

        service.receivePlateLog(request(CAR_NUM, "0.999"), null);

        verify(alertService, never()).sendPredictiveAlert(anyLong(), anyLong(), anyString());
    }

    @Test
    @DisplayName("접근 카메라 + 위험도 위험이어도 등록 차량이 아니면(UNMATCHED) 알림 없음")
    void approachCamera_unmatched_noAlert() {
        givenCamera(CameraRole.APPROACH_LPR);
        when(carDao.selectCarByCarNum(CAR_NUM)).thenReturn(null);
        givenUnderpass(underpass(RiskLevel.DANGER, UnderpassCurrentStatus.NORMAL, null));

        service.receivePlateLog(request(CAR_NUM, "0.999"), null);

        verify(alertService, never()).sendPredictiveAlert(anyLong(), anyLong(), anyString());
        verify(alertService, never()).sendRoiFinalAlert(anyLong(), anyLong(), anyString());
    }

    @Test
    @DisplayName("신뢰도가 낮아도(LOW_CONFIDENCE) 차량이 매칭되면 안전 우선으로 알림을 보낸다")
    void lowConfidenceMatched_stillSendsAlert() {
        givenCamera(CameraRole.APPROACH_LPR);
        givenRegisteredCar();
        givenUnderpass(underpass(RiskLevel.DANGER, UnderpassCurrentStatus.NORMAL, null));
        UnderpassEvent riseEvent = new UnderpassEvent();
        riseEvent.setId(78L);
        when(underpassEventDao.selectLatestRiskLevelUpEvent(UNDERPASS_ID)).thenReturn(riseEvent);

        service.receivePlateLog(request(CAR_NUM, "0.500"), null);

        verify(alertService).sendPredictiveAlert(78L, CAR_ID, CAR_NUM);
    }

    @Test
    @DisplayName("위험도 상승 이벤트 기록이 없으면 사전예측 알림을 보내지 않는다")
    void approachCamera_noRiseEvent_noAlert() {
        givenCamera(CameraRole.APPROACH_LPR);
        givenRegisteredCar();
        givenUnderpass(underpass(RiskLevel.WARNING, UnderpassCurrentStatus.NORMAL, null));
        when(underpassEventDao.selectLatestRiskLevelUpEvent(UNDERPASS_ID)).thenReturn(null);

        service.receivePlateLog(request(CAR_NUM, "0.999"), null);

        verify(alertService, never()).sendPredictiveAlert(anyLong(), anyLong(), anyString());
    }

    @Test
    @DisplayName("진입직전(ROI) 카메라 + 매칭 + 차단 중 → 최후확인 알림 발송")
    void roiCamera_blocked_sendsFinalAlert() {
        givenCamera(CameraRole.ROI_LPR);
        givenRegisteredCar();
        givenUnderpass(underpass(RiskLevel.DANGER, UnderpassCurrentStatus.BLOCKED, 99L));

        service.receivePlateLog(request(CAR_NUM, "0.999"), null);

        verify(alertService).sendRoiFinalAlert(99L, CAR_ID, CAR_NUM);
        verify(alertService, never()).sendPredictiveAlert(anyLong(), anyLong(), anyString());
    }

    @Test
    @DisplayName("진입직전(ROI) 카메라라도 차단 중이 아니면(정상) 알림 없음")
    void roiCamera_notBlocked_noAlert() {
        givenCamera(CameraRole.ROI_LPR);
        givenRegisteredCar();
        givenUnderpass(underpass(RiskLevel.DANGER, UnderpassCurrentStatus.NORMAL, null));

        service.receivePlateLog(request(CAR_NUM, "0.999"), null);

        verify(alertService, never()).sendRoiFinalAlert(anyLong(), anyLong(), anyString());
    }

    @Test
    @DisplayName("일반 CCTV 카메라는 매칭돼도 알림을 보내지 않는다")
    void cctvCamera_neverAlerts() {
        givenCamera(CameraRole.CCTV);
        givenRegisteredCar();
        givenUnderpass(underpass(RiskLevel.DANGER, UnderpassCurrentStatus.BLOCKED, 99L));

        service.receivePlateLog(request(CAR_NUM, "0.999"), null);

        verify(alertService, never()).sendPredictiveAlert(anyLong(), anyLong(), anyString());
        verify(alertService, never()).sendRoiFinalAlert(anyLong(), anyLong(), anyString());
    }

    // ---------- 3. 입구/출구 통과 기록 ----------

    @Test
    @DisplayName("입구 카메라로 지정된 카메라가 번호를 읽으면 IN_TRANSIT 기록이 생긴다")
    void entryCamera_createsInTransit() {
        givenCamera(CameraRole.CCTV);
        givenRegisteredCar();
        UnderpassDetailResponse u = underpass(RiskLevel.SAFE, UnderpassCurrentStatus.NORMAL, null);
        u.setEntryCameraId(CAMERA_ID);
        givenUnderpass(u);

        service.receivePlateLog(request(CAR_NUM, "0.999"), null);

        ArgumentCaptor<UnderpassTransit> captor = ArgumentCaptor.forClass(UnderpassTransit.class);
        verify(underpassTransitDao).insertTransit(captor.capture());
        assertEquals(CAR_NUM, captor.getValue().getCarNum());
        assertEquals(TransitStatus.IN_TRANSIT, captor.getValue().getStatus());
    }

    @Test
    @DisplayName("입구에서 번호를 못 읽으면(FAILED) 유령 통과 기록을 만들지 않는다")
    void entryCamera_unreadable_noTransit() {
        givenCamera(CameraRole.CCTV);
        UnderpassDetailResponse u = underpass(RiskLevel.SAFE, UnderpassCurrentStatus.NORMAL, null);
        u.setEntryCameraId(CAMERA_ID);
        givenUnderpass(u);

        service.receivePlateLog(request(null, null), null);

        verify(underpassTransitDao, never()).insertTransit(any(UnderpassTransit.class));
    }

    @Test
    @DisplayName("출구 카메라가 같은 번호를 읽으면 해당 통과 기록을 종료(EXITED) 처리한다")
    void exitCamera_closesActiveTransit() {
        givenCamera(CameraRole.CCTV);
        givenRegisteredCar();
        UnderpassDetailResponse u = underpass(RiskLevel.SAFE, UnderpassCurrentStatus.NORMAL, null);
        u.setExitCameraId(CAMERA_ID);
        givenUnderpass(u);
        UnderpassTransit active = new UnderpassTransit();
        active.setId(500L);
        when(underpassTransitDao.selectActiveTransitByCarNum(UNDERPASS_ID, CAR_NUM)).thenReturn(active);

        service.receivePlateLog(request(CAR_NUM, "0.999"), null);

        verify(underpassTransitDao).updateTransitExit(org.mockito.ArgumentMatchers.eq(500L), any(), org.mockito.ArgumentMatchers.eq(DETECTED_AT));
    }
}