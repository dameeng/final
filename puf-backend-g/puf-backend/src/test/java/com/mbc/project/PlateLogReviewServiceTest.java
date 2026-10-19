package com.mbc.project;

import static com.mbc.project.TestEntities.withId;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

import com.mbc.puf.alert.service.AlertService;
import com.mbc.puf.car.entity.Car;
import com.mbc.puf.car.repository.CarRepository;
import com.mbc.puf.common.enums.CameraRole;
import com.mbc.puf.common.enums.ReviewStatus;
import com.mbc.puf.common.enums.RiskLevel;
import com.mbc.puf.common.enums.UnderpassCurrentStatus;
import com.mbc.puf.common.enums.UnderpassEventType;
import com.mbc.puf.common.exception.BusinessException;
import com.mbc.puf.common.jpa.DbClock;
import com.mbc.puf.common.security.LoginUser;
import com.mbc.puf.common.security.ScopeResolver;
import com.mbc.puf.member.repository.ManagerRegionRepository;
import com.mbc.puf.plate.dto.PlateLogReviewRequest;
import com.mbc.puf.plate.dto.PlateLogReviewResponse;
import com.mbc.puf.plate.entity.PlateLog;
import com.mbc.puf.plate.repository.PlateLogRepository;
import com.mbc.puf.plate.service.PlateLogReviewServiceImpl;
import com.mbc.puf.underpass.entity.Camera;
import com.mbc.puf.underpass.entity.Underpass;
import com.mbc.puf.underpass.entity.UnderpassEvent;
import com.mbc.puf.underpass.repository.CameraRepository;
import com.mbc.puf.underpass.repository.UnderpassEventRepository;
import com.mbc.puf.underpass.repository.UnderpassRepository;

import jakarta.persistence.EntityManager;

/**
 * 관리자 수동 판별 단위 테스트 (번호판 텍스트를 고쳐서 다시 매칭).
 * 대상: PlateLogReviewServiceImpl
 *  - 권한: 담당 지역(manager_region)의 기록만 판별 가능 (여러 지역 담당 가능)
 *  - 정정한 번호가 등록 차량과 매칭되면 카메라 역할에 따라 알림 발송
 * (판별대기 목록의 지역 제한은 공통 ScopeResolver 가 맡으므로 ScopeResolverTest 에서 확인한다)
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
    private static final LocalDateTime NOW = LocalDateTime.of(2026, 10, 16, 9, 0);

    @Mock private PlateLogRepository plateLogRepository;
    @Mock private UnderpassRepository underpassRepository;
    @Mock private UnderpassEventRepository eventRepository;
    @Mock private CameraRepository cameraRepository;
    @Mock private CarRepository carRepository;
    @Mock private AlertService alertService;
    @Mock private DbClock dbClock;
    @Mock private ManagerRegionRepository managerRegionRepository;
    @Mock private EntityManager em;

    private PlateLogReviewServiceImpl service;

    // 관리자 1 = A·B 두 지역 담당, 관리자 2 = A 지역만 담당
    private final LoginUser managerAB = new LoginUser(1L, "MANAGER", "REGIONAL_ADMIN");
    private final LoginUser regionalA = new LoginUser(2L, "MANAGER", "REGIONAL_ADMIN");

    @BeforeEach
    void setUp() {
        lenient().when(managerRegionRepository.findRegionIds(1L)).thenReturn(List.of(REGION_A, REGION_B));
        lenient().when(managerRegionRepository.findRegionIds(2L)).thenReturn(List.of(REGION_A));
        service = new PlateLogReviewServiceImpl(plateLogRepository, underpassRepository, eventRepository,
                cameraRepository, carRepository, alertService,
                new ScopeResolver(underpassRepository, managerRegionRepository), dbClock, em);
    }

    private PlateLogReviewRequest reviewRequest(String num) {
        PlateLogReviewRequest r = new PlateLogReviewRequest();
        r.setCorrectedNum(num);
        return r;
    }

    // 인식 기록 + 그 기록을 찍은 카메라(지하차도 소속)
    private PlateLog givenLogFromCamera(CameraRole role) {
        PlateLog log = withId(new PlateLog(), LOG_ID);
        log.setCameraId(CAMERA_ID);
        log.setReviewStatus(ReviewStatus.PENDING);
        when(plateLogRepository.findById(LOG_ID)).thenReturn(Optional.of(log));
        Camera camera = withId(new Camera(), CAMERA_ID);
        camera.setUnderpassId(UNDERPASS_ID);
        camera.setCameraRole(role);
        when(cameraRepository.findById(CAMERA_ID)).thenReturn(Optional.of(camera));
        return log;
    }

    private void givenUnderpass(Long regionId, RiskLevel risk, UnderpassCurrentStatus status, Long blockEventId) {
        Underpass u = withId(new Underpass(), UNDERPASS_ID);
        u.setRegionId(regionId);
        u.setCurrentRiskLevel(risk);
        u.setCurrentStatus(status);
        u.setCurrentBlockEventId(blockEventId);
        when(underpassRepository.findByIdAndDeletedFalse(UNDERPASS_ID)).thenReturn(Optional.of(u));
    }

    private void givenCarRegistered() {
        when(carRepository.findActiveByCarNum(NUM)).thenReturn(List.of(withId(new Car(), CAR_ID)));
    }

    // ---------- 수동 판별 ----------

    @Test
    @DisplayName("없는 인식 기록이면 404")
    void review_unknownLog_isNotFound() {
        when(plateLogRepository.findById(LOG_ID)).thenReturn(Optional.empty());

        BusinessException e = assertThrows(BusinessException.class,
                () -> service.review(managerAB, LOG_ID, reviewRequest(NUM)));

        assertEquals(HttpStatus.NOT_FOUND, e.getStatus());
    }

    @Test
    @DisplayName("지역담당자가 다른 지역의 인식 기록을 판별하면 403이고 아무것도 바꾸지 않는다")
    void review_otherRegion_isForbidden() {
        PlateLog log = givenLogFromCamera(CameraRole.CCTV);
        givenUnderpass(REGION_B, RiskLevel.SAFE, UnderpassCurrentStatus.NORMAL, null);

        BusinessException e = assertThrows(BusinessException.class,
                () -> service.review(regionalA, LOG_ID, reviewRequest(NUM)));

        assertEquals(HttpStatus.FORBIDDEN, e.getStatus());
        assertEquals(ReviewStatus.PENDING, log.getReviewStatus());
        assertNull(log.getCorrectedNum());
    }

    @Test
    @DisplayName("여러 지역을 담당하면 담당 지역 어디든 판별할 수 있다")
    void review_multiRegionManager_canReviewOwnRegions() {
        givenLogFromCamera(CameraRole.CCTV);
        givenUnderpass(REGION_B, RiskLevel.SAFE, UnderpassCurrentStatus.NORMAL, null);
        givenCarRegistered();
        when(dbClock.now()).thenReturn(NOW);

        PlateLogReviewResponse response = service.review(managerAB, LOG_ID, reviewRequest(NUM));

        assertEquals(ReviewStatus.CONFIRMED, response.getReviewStatus());
        assertEquals(CAR_ID, response.getCarId());
    }

    @Test
    @DisplayName("지역담당자는 담당 지역의 기록을 판별할 수 있고, 입력한 번호의 앞뒤 공백은 제거된다")
    void review_ownRegion_trimsCorrectedNum() {
        PlateLog log = givenLogFromCamera(CameraRole.CCTV);
        givenUnderpass(REGION_A, RiskLevel.SAFE, UnderpassCurrentStatus.NORMAL, null);
        when(carRepository.findActiveByCarNum(NUM)).thenReturn(List.of());
        when(dbClock.now()).thenReturn(NOW);

        PlateLogReviewResponse response = service.review(regionalA, LOG_ID, reviewRequest("  " + NUM + "  "));

        assertEquals(NUM, response.getCorrectedNum());
        assertEquals(NUM, log.getCorrectedNum());
        assertNull(log.getCarId());
        assertEquals(ReviewStatus.CONFIRMED, log.getReviewStatus());
        assertNull(log.getReviewDeadline());
        assertEquals(2L, log.getReviewedBy());
        assertEquals(NOW, log.getReviewedAt());
    }

    @Test
    @DisplayName("정정한 번호가 등록 차량과 안 맞으면 알림 없이 확정만 된다 (carId 없음)")
    void review_noMatchingCar_noAlert() {
        givenLogFromCamera(CameraRole.FINAL_LPR);
        givenUnderpass(REGION_A, RiskLevel.DANGER, UnderpassCurrentStatus.BLOCKED, 99L);
        when(carRepository.findActiveByCarNum(NUM)).thenReturn(List.of());
        when(dbClock.now()).thenReturn(NOW);

        PlateLogReviewResponse response = service.review(regionalA, LOG_ID, reviewRequest(NUM));

        assertNull(response.getCarId());
        assertEquals(ReviewStatus.CONFIRMED, response.getReviewStatus());
        verify(alertService, never()).sendPredictiveAlert(anyLong(), anyLong(), anyString());
        verify(alertService, never()).sendRoiFinalAlert(anyLong(), anyLong(), anyString());
    }

    @Test
    @DisplayName("접근 카메라 기록을 정정해서 매칭되고 위험도가 주의 이상이면 사전예측 알림이 나간다")
    void review_approachCamera_sendsPredictiveAlert() {
        givenLogFromCamera(CameraRole.APPROACH_LPR);
        givenUnderpass(REGION_A, RiskLevel.WARNING, UnderpassCurrentStatus.NORMAL, null);
        givenCarRegistered();
        when(dbClock.now()).thenReturn(NOW);
        when(eventRepository.findFirstByUnderpassIdAndEventTypeOrderByCreatedAtDescIdDesc(UNDERPASS_ID,
                UnderpassEventType.RISK_LEVEL_UP)).thenReturn(Optional.of(withId(new UnderpassEvent(), 77L)));

        service.review(regionalA, LOG_ID, reviewRequest(NUM));

        verify(alertService).sendPredictiveAlert(77L, CAR_ID, NUM);
    }

    @Test
    @DisplayName("진입직전(FINAL) 카메라 기록을 정정해서 매칭되고 차단 중이면 최후확인 알림이 나간다")
    void review_finalCamera_sendsFinalAlert() {
        givenLogFromCamera(CameraRole.FINAL_LPR);
        givenUnderpass(REGION_A, RiskLevel.DANGER, UnderpassCurrentStatus.BLOCKED, 99L);
        givenCarRegistered();
        when(dbClock.now()).thenReturn(NOW);

        service.review(regionalA, LOG_ID, reviewRequest(NUM));

        verify(alertService).sendRoiFinalAlert(99L, CAR_ID, NUM);
    }

    @Test
    @DisplayName("진입직전(FINAL) 카메라 기록이라도 차단 중이 아니면 알림은 나가지 않는다")
    void review_finalCamera_notBlocked_noAlert() {
        givenLogFromCamera(CameraRole.FINAL_LPR);
        givenUnderpass(REGION_A, RiskLevel.DANGER, UnderpassCurrentStatus.NORMAL, null);
        givenCarRegistered();
        when(dbClock.now()).thenReturn(NOW);

        service.review(regionalA, LOG_ID, reviewRequest(NUM));

        verify(alertService, never()).sendRoiFinalAlert(anyLong(), anyLong(), anyString());
    }

    // ---------- 자동 처리 ----------

    @Test
    @DisplayName("1분 지난 판별 대기 건은 DB 시각 기준으로 자동 처리한다")
    void autoProcessExpired_usesDbClock() {
        when(dbClock.now()).thenReturn(NOW);

        service.autoProcessExpired();

        verify(plateLogRepository).autoProcessExpired(NOW);
    }
}
