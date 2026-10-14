package com.mbc.project;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

import com.mbc.puf.alert.dao.AlertDao;
import com.mbc.puf.alert.dto.AlertLog;
import com.mbc.puf.alert.dto.AlertLogListItem;
import com.mbc.puf.alert.service.AlertServiceImpl;
import com.mbc.puf.car.dao.CarDao;
import com.mbc.puf.car.dto.Car;
import com.mbc.puf.common.enums.AlertType;
import com.mbc.puf.common.enums.RiskLevel;
import com.mbc.puf.common.exception.BusinessException;
import com.mbc.puf.common.response.PageResponse;
import com.mbc.puf.common.security.LoginUser;
import com.mbc.puf.threshold.dao.ThresholdDao;
import com.mbc.puf.threshold.dto.Threshold;
import com.mbc.puf.threshold.dto.ThresholdHistory;
import com.mbc.puf.threshold.dto.ThresholdUpdateRequest;
import com.mbc.puf.threshold.service.ThresholdServiceImpl;
import com.mbc.puf.underpass.dao.UnderpassDao;
import com.mbc.puf.underpass.dto.UnderpassDetailResponse;

/**
 * 알림 발송(AlertServiceImpl)과 임계치 설정(ThresholdServiceImpl) 단위 테스트.
 * 한 파일 안에 클래스 두 묶음(@Nested)으로 나눠 두었다. JUnit 탭에서 묶음별로 접어서 볼 수 있다.
 */
class AlertAndThresholdServiceTest {

    // ===================== 알림 =====================

    @Nested
    @ExtendWith(MockitoExtension.class)
    @DisplayName("알림 발송")
    class AlertTests {

        @Mock private AlertDao alertDao;
        @Mock private CarDao carDao;
        @InjectMocks private AlertServiceImpl service;

        private Car carOf(Long customerId) {
            Car car = new Car();
            car.setId(5L);
            car.setCustomerId(customerId);
            return car;
        }

        @Test
        @DisplayName("사전예측 알림: 차량 주인(고객)에게 PREDICTIVE 로그가 남고, 발송 시점의 차량번호가 저장된다")
        void predictive_savesLogForOwner() {
            when(carDao.selectCarById(5L)).thenReturn(carOf(42L));

            service.sendPredictiveAlert(77L, 5L, "12가3456");

            ArgumentCaptor<AlertLog> captor = ArgumentCaptor.forClass(AlertLog.class);
            verify(alertDao).insertAlertLog(captor.capture());
            assertEquals(AlertType.PREDICTIVE, captor.getValue().getAlertType());
            assertEquals(42L, captor.getValue().getCustomerId());
            assertEquals(5L, captor.getValue().getCarId());
            assertEquals("12가3456", captor.getValue().getCarNum());
            assertEquals(77L, captor.getValue().getEventId());
        }

        @Test
        @DisplayName("최후확인 알림: ROI_FINAL 로그가 남는다")
        void roiFinal_savesLog() {
            when(carDao.selectCarById(5L)).thenReturn(carOf(42L));

            service.sendRoiFinalAlert(99L, 5L, "12가3456");

            ArgumentCaptor<AlertLog> captor = ArgumentCaptor.forClass(AlertLog.class);
            verify(alertDao).insertAlertLog(captor.capture());
            assertEquals(AlertType.ROI_FINAL, captor.getValue().getAlertType());
        }

        @Test
        @DisplayName("차량이 이미 삭제됐으면(조회 결과 없음) 알림 로그를 만들지 않고 조용히 넘어간다")
        void carDeleted_noLog() {
            when(carDao.selectCarById(5L)).thenReturn(null);

            service.sendPredictiveAlert(77L, 5L, "12가3456");

            verify(alertDao, never()).insertAlertLog(any(AlertLog.class));
        }

        @Test
        @DisplayName("알림 로그 조회: 종료일은 '그날 포함'이 되도록 다음날 0시로 넘어간다")
        void alertLogs_endDateIsInclusive() {
            when(alertDao.countAlertLogs(any(), any(), any(), any(), any(), any())).thenReturn(0L);

            PageResponse<AlertLogListItem> result = service.getAlertLogs(null, null, null,
                    LocalDate.of(2026, 10, 1), LocalDate.of(2026, 10, 3), null, 1, 20);

            assertTrue(result.getItems().isEmpty());
            verify(alertDao).countAlertLogs(null, null, null,
                    LocalDate.of(2026, 10, 1).atStartOfDay(),
                    LocalDate.of(2026, 10, 4).atStartOfDay(), null);
        }

        @Test
        @DisplayName("내 알림: 0건이면 목록 조회 쿼리를 아예 부르지 않는다")
        void myAlerts_empty_skipsSelect() {
            when(alertDao.countMyAlerts(42L, null)).thenReturn(0L);

            service.getMyAlerts(42L, null, 1, 20);

            verify(alertDao, never()).selectMyAlerts(any(), any(), org.mockito.ArgumentMatchers.anyInt(),
                    org.mockito.ArgumentMatchers.anyInt());
        }
    }

    // ===================== 임계치 =====================

    @Nested
    @ExtendWith(MockitoExtension.class)
    @DisplayName("임계치 설정")
    class ThresholdTests {

        private static final Long UNDERPASS_ID = 1L;
        private static final Long REGION_A = 11L;
        private static final Long REGION_B = 22L;

        @Mock private ThresholdDao thresholdDao;
        @Mock private UnderpassDao underpassDao;
        @InjectMocks private ThresholdServiceImpl service;

        private final LoginUser superAdmin = new LoginUser(1L, "MANAGER", "SUPER_ADMIN", null);
        private final LoginUser regionalA = new LoginUser(2L, "MANAGER", "REGIONAL_ADMIN", REGION_A);

        private ThresholdUpdateRequest update(String min) {
            ThresholdUpdateRequest r = new ThresholdUpdateRequest();
            r.setRiskScoreMin(new BigDecimal(min));
            return r;
        }

        private void givenUnderpass(Long regionId) {
            UnderpassDetailResponse u = new UnderpassDetailResponse();
            u.setId(UNDERPASS_ID);
            u.setRegionId(regionId);
            when(underpassDao.selectUnderpassById(UNDERPASS_ID)).thenReturn(u);
        }

        private Threshold warning(String min) {
            Threshold t = new Threshold();
            t.setId(200L);
            t.setUnderpassId(UNDERPASS_ID);
            t.setLevel(RiskLevel.WARNING);
            t.setRiskScoreMin(new BigDecimal(min));
            return t;
        }

        @Test
        @DisplayName("지하차도를 등록하면 기본 임계치 3개(안전 0 / 경고 40 / 위험 70)가 만들어지고 이력도 남는다")
        void createDefaults_makesThreeRowsWithHistory() {
            service.createDefaultThresholds(UNDERPASS_ID, 1L);

            ArgumentCaptor<Threshold> captor = ArgumentCaptor.forClass(Threshold.class);
            verify(thresholdDao, times(3)).insertThreshold(captor.capture());
            List<Threshold> rows = captor.getAllValues();
            assertEquals(RiskLevel.SAFE, rows.get(0).getLevel());
            assertEquals(new BigDecimal("0.00"), rows.get(0).getRiskScoreMin());
            assertEquals(RiskLevel.WARNING, rows.get(1).getLevel());
            assertEquals(new BigDecimal("40.00"), rows.get(1).getRiskScoreMin());
            assertEquals(RiskLevel.DANGER, rows.get(2).getLevel());
            assertEquals(new BigDecimal("70.00"), rows.get(2).getRiskScoreMin());
            verify(thresholdDao, times(3)).insertThresholdHistory(any(ThresholdHistory.class));
        }

        @Test
        @DisplayName("없는 지하차도면 404")
        void update_unknownUnderpass_isNotFound() {
            when(underpassDao.selectUnderpassById(UNDERPASS_ID)).thenReturn(null);

            BusinessException e = assertThrows(BusinessException.class,
                    () -> service.updateThreshold(superAdmin, UNDERPASS_ID, RiskLevel.WARNING, update("45")));

            assertEquals(HttpStatus.NOT_FOUND, e.getStatus());
        }

        @Test
        @DisplayName("지역담당자가 담당 지역이 아닌 지하차도의 임계치를 바꾸면 403")
        void update_otherRegion_isForbidden() {
            givenUnderpass(REGION_B);

            BusinessException e = assertThrows(BusinessException.class,
                    () -> service.updateThreshold(regionalA, UNDERPASS_ID, RiskLevel.WARNING, update("45")));

            assertEquals(HttpStatus.FORBIDDEN, e.getStatus());
            verify(thresholdDao, never()).updateThresholdValue(any(), any(), any(), any());
        }

        @Test
        @DisplayName("임계치 행이 없으면 404")
        void update_missingThreshold_isNotFound() {
            givenUnderpass(REGION_A);
            when(thresholdDao.selectThreshold(UNDERPASS_ID, RiskLevel.WARNING)).thenReturn(null);

            BusinessException e = assertThrows(BusinessException.class,
                    () -> service.updateThreshold(regionalA, UNDERPASS_ID, RiskLevel.WARNING, update("45")));

            assertEquals(HttpStatus.NOT_FOUND, e.getStatus());
        }

        @Test
        @DisplayName("담당 지역 임계치를 바꾸면 값이 갱신되고 이전 값→새 값 이력이 남는다")
        void update_ownRegion_updatesAndRecordsHistory() {
            givenUnderpass(REGION_A);
            when(thresholdDao.selectThreshold(UNDERPASS_ID, RiskLevel.WARNING))
                    .thenReturn(warning("40.00"), warning("45.00"));

            service.updateThreshold(regionalA, UNDERPASS_ID, RiskLevel.WARNING, update("45.00"));

            verify(thresholdDao).updateThresholdValue(UNDERPASS_ID, RiskLevel.WARNING, new BigDecimal("45.00"), 2L);
            ArgumentCaptor<ThresholdHistory> captor = ArgumentCaptor.forClass(ThresholdHistory.class);
            verify(thresholdDao).insertThresholdHistory(captor.capture());
            assertEquals(new BigDecimal("40.00"), captor.getValue().getOldRiskScoreMin());
            assertEquals(new BigDecimal("45.00"), captor.getValue().getNewRiskScoreMin());
            assertEquals(2L, captor.getValue().getChangedBy());
        }

        @Test
        @DisplayName("최고관리자는 어느 지역의 임계치든 바꿀 수 있다")
        void update_superAdmin_anyRegion() {
            givenUnderpass(REGION_B);
            when(thresholdDao.selectThreshold(UNDERPASS_ID, RiskLevel.WARNING))
                    .thenReturn(warning("40.00"), warning("50.00"));

            service.updateThreshold(superAdmin, UNDERPASS_ID, RiskLevel.WARNING, update("50.00"));

            verify(thresholdDao).updateThresholdValue(UNDERPASS_ID, RiskLevel.WARNING, new BigDecimal("50.00"), 1L);
        }

        @Test
        @DisplayName("기본 임계치 생성 시 이력의 이전 값은 비어 있다(최초 생성)")
        void createDefaults_historyOldValueIsNull() {
            service.createDefaultThresholds(UNDERPASS_ID, 1L);

            ArgumentCaptor<ThresholdHistory> captor = ArgumentCaptor.forClass(ThresholdHistory.class);
            verify(thresholdDao, times(3)).insertThresholdHistory(captor.capture());
            assertNull(captor.getAllValues().get(0).getOldRiskScoreMin());
        }
    }
}
