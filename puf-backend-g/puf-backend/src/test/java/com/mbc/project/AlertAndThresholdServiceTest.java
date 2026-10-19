package com.mbc.project;

import static com.mbc.project.TestEntities.withId;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

import com.mbc.puf.alert.entity.Alert;
import com.mbc.puf.alert.repository.AlertRepository;
import com.mbc.puf.alert.service.AlertServiceImpl;
import com.mbc.puf.car.entity.Car;
import com.mbc.puf.car.repository.CarRepository;
import com.mbc.puf.common.enums.AlertType;
import com.mbc.puf.common.enums.RiskLevel;
import com.mbc.puf.common.exception.BusinessException;
import com.mbc.puf.common.jpa.DbClock;
import com.mbc.puf.common.query.QueryConditions;
import com.mbc.puf.common.request.PeriodQuery;
import com.mbc.puf.common.security.LoginUser;
import com.mbc.puf.common.security.ScopeResolver;
import com.mbc.puf.member.repository.ManagerRegionRepository;
import com.mbc.puf.threshold.dto.ThresholdUpdateRequest;
import com.mbc.puf.threshold.entity.Threshold;
import com.mbc.puf.threshold.entity.ThresholdHistory;
import com.mbc.puf.threshold.repository.ThresholdHistoryRepository;
import com.mbc.puf.threshold.repository.ThresholdRepository;
import com.mbc.puf.threshold.service.ThresholdServiceImpl;
import com.mbc.puf.underpass.entity.Underpass;
import com.mbc.puf.underpass.repository.UnderpassRepository;

import jakarta.persistence.EntityManager;

/**
 * 알림 발송(AlertServiceImpl), 기간 조건(PeriodQuery), 임계치 설정(ThresholdServiceImpl) 단위 테스트.
 * 한 파일 안에 묶음(@Nested)으로 나눠 두었다. JUnit 탭에서 묶음별로 접어서 볼 수 있다.
 */
class AlertAndThresholdServiceTest {

    // ===================== 알림 =====================

    @Nested
    @ExtendWith(MockitoExtension.class)
    @DisplayName("알림 발송")
    class AlertTests {

        @Mock private AlertRepository alertRepository;
        @Mock private CarRepository carRepository;
        @InjectMocks private AlertServiceImpl service;

        private Car carOf(Long customerId) {
            Car car = withId(new Car(), 5L);
            car.setCustomerId(customerId);
            return car;
        }

        private Alert savedAlert() {
            ArgumentCaptor<Alert> captor = ArgumentCaptor.forClass(Alert.class);
            verify(alertRepository).save(captor.capture());
            return captor.getValue();
        }

        @Test
        @DisplayName("사전예측 알림: 차량 주인(고객)에게 PREDICTIVE 로그가 남고, 발송 시점의 차량번호가 저장된다")
        void predictive_savesLogForOwner() {
            when(carRepository.findById(5L)).thenReturn(Optional.of(carOf(42L)));

            service.sendPredictiveAlert(77L, 5L, "12가3456");

            Alert alert = savedAlert();
            assertEquals(AlertType.PREDICTIVE, alert.getAlertType());
            assertEquals(42L, alert.getCustomerId());
            assertEquals(5L, alert.getCarId());
            assertEquals("12가3456", alert.getCarNum());
            assertEquals(77L, alert.getEventId());
        }

        @Test
        @DisplayName("최후확인 알림: FINAL 로그가 남는다")
        void roiFinal_savesLog() {
            when(carRepository.findById(5L)).thenReturn(Optional.of(carOf(42L)));

            service.sendRoiFinalAlert(99L, 5L, "12가3456");

            assertEquals(AlertType.FINAL, savedAlert().getAlertType());
        }

        @Test
        @DisplayName("차량이 이미 삭제됐으면(조회 결과 없음) 알림 로그를 만들지 않고 조용히 넘어간다")
        void carDeleted_noLog() {
            when(carRepository.findById(5L)).thenReturn(Optional.empty());

            service.sendPredictiveAlert(77L, 5L, "12가3456");

            verify(alertRepository, never()).save(any(Alert.class));
        }
    }

    // ===================== 공통 조건: 기간 =====================

    @Nested
    @DisplayName("공통 Period 조건")
    class PeriodTests {

        @Test
        @DisplayName("종료일은 '그날 포함'이 되도록 다음날 0시(배타적 상한)로 바뀐다")
        void endDateIsInclusive() {
            PeriodQuery period = PeriodQuery.of(LocalDate.of(2026, 10, 1), LocalDate.of(2026, 10, 3));

            assertEquals(LocalDateTime.of(2026, 10, 1, 0, 0), period.startAt());
            assertEquals(LocalDateTime.of(2026, 10, 4, 0, 0), period.endAtExclusive());
        }

        @Test
        @DisplayName("시작일이 종료일보다 늦으면 400")
        void startAfterEnd_isBadRequest() {
            BusinessException e = assertThrows(BusinessException.class,
                    () -> PeriodQuery.of(LocalDate.of(2026, 10, 5), LocalDate.of(2026, 10, 3)));

            assertEquals(HttpStatus.BAD_REQUEST, e.getStatus());
        }

        @Test
        @DisplayName("값이 없는 조건은 WHERE 절에서 빠진다 (MyBatis <if> 와 같음)")
        void emptyConditionsAreSkipped() {
            QueryConditions c = new QueryConditions()
                    .eqIfPresent("a.customerId", null)
                    .containsIfPresent("  ", "a.title")
                    .periodIfPresent("a.sentAt", PeriodQuery.of(null, null));

            assertTrue(c.where().isEmpty());
        }

        @Test
        @DisplayName("기간 조건은 시작일 이상 ~ 종료일 다음날 미만으로 붙는다")
        void periodConditionIsHalfOpen() {
            QueryConditions c = new QueryConditions()
                    .periodIfPresent("a.sentAt", PeriodQuery.of(LocalDate.of(2026, 10, 1), LocalDate.of(2026, 10, 3)));

            assertEquals(" where a.sentAt >= :p1 and a.sentAt < :p2", c.where());
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

        @Mock private ThresholdRepository thresholdRepository;
        @Mock private ThresholdHistoryRepository historyRepository;
        @Mock private UnderpassRepository underpassRepository;
        @Mock private DbClock dbClock;
        @Mock private EntityManager em;
        @Mock private ManagerRegionRepository managerRegionRepository;
        private ThresholdServiceImpl service;

        // 관리자 1 = A·B 두 지역 담당, 관리자 2 = A 지역만 담당 (담당 지역은 manager_region 에서 읽는다)
        private final LoginUser managerAB = new LoginUser(1L, "MANAGER", "REGIONAL_ADMIN");
        private final LoginUser regionalA = new LoginUser(2L, "MANAGER", "REGIONAL_ADMIN");

        @BeforeEach
        void setUp() {
            lenient().when(managerRegionRepository.findRegionIds(1L)).thenReturn(List.of(REGION_A, REGION_B));
            lenient().when(managerRegionRepository.findRegionIds(2L)).thenReturn(List.of(REGION_A));
            ScopeResolver scopeResolver = new ScopeResolver(underpassRepository, managerRegionRepository);
            service = new ThresholdServiceImpl(thresholdRepository, historyRepository, underpassRepository, dbClock, em,
                    scopeResolver);
        }

        private ThresholdUpdateRequest update(String min) {
            ThresholdUpdateRequest r = new ThresholdUpdateRequest();
            r.setRiskScoreMin(new BigDecimal(min));
            return r;
        }

        private void givenUnderpass(Long regionId) {
            Underpass u = withId(new Underpass(), UNDERPASS_ID);
            u.setRegionId(regionId);
            when(underpassRepository.findByIdAndDeletedFalse(UNDERPASS_ID)).thenReturn(Optional.of(u));
        }

        private Threshold warning(String min) {
            Threshold t = withId(new Threshold(), 200L);
            t.setUnderpassId(UNDERPASS_ID);
            t.setLevel(RiskLevel.WARNING);
            t.setRiskScoreMin(new BigDecimal(min));
            return t;
        }

        @Test
        @DisplayName("지하차도를 등록하면 기본 임계치 3개(안전 0 / 주의 40 / 위험 70)가 만들어지고 이력도 남는다")
        void createDefaults_makesThreeRowsWithHistory() {
            service.createDefaultThresholds(UNDERPASS_ID, 1L);

            ArgumentCaptor<Threshold> captor = ArgumentCaptor.forClass(Threshold.class);
            verify(thresholdRepository, times(3)).saveAndFlush(captor.capture());
            List<Threshold> rows = captor.getAllValues();
            assertEquals(RiskLevel.SAFE, rows.get(0).getLevel());
            assertEquals(new BigDecimal("0.00"), rows.get(0).getRiskScoreMin());
            assertEquals(RiskLevel.WARNING, rows.get(1).getLevel());
            assertEquals(new BigDecimal("40.00"), rows.get(1).getRiskScoreMin());
            assertEquals(RiskLevel.DANGER, rows.get(2).getLevel());
            assertEquals(new BigDecimal("70.00"), rows.get(2).getRiskScoreMin());
            verify(historyRepository, times(3)).save(any(ThresholdHistory.class));
        }

        @Test
        @DisplayName("없는 지하차도면 404")
        void update_unknownUnderpass_isNotFound() {
            when(underpassRepository.findByIdAndDeletedFalse(UNDERPASS_ID)).thenReturn(Optional.empty());

            BusinessException e = assertThrows(BusinessException.class,
                    () -> service.updateThreshold(managerAB, UNDERPASS_ID, RiskLevel.WARNING, update("45")));

            assertEquals(HttpStatus.NOT_FOUND, e.getStatus());
        }

        @Test
        @DisplayName("지역담당자가 담당 지역이 아닌 지하차도의 임계치를 바꾸면 403")
        void update_otherRegion_isForbidden() {
            givenUnderpass(REGION_B);

            BusinessException e = assertThrows(BusinessException.class,
                    () -> service.updateThreshold(regionalA, UNDERPASS_ID, RiskLevel.WARNING, update("45")));

            assertEquals(HttpStatus.FORBIDDEN, e.getStatus());
            verify(thresholdRepository, never()).findByUnderpassIdAndLevel(any(), any());
            verify(historyRepository, never()).save(any(ThresholdHistory.class));
        }

        @Test
        @DisplayName("임계치 행이 없으면 404")
        void update_missingThreshold_isNotFound() {
            givenUnderpass(REGION_A);
            when(thresholdRepository.findByUnderpassIdAndLevel(UNDERPASS_ID, RiskLevel.WARNING)).thenReturn(Optional.empty());

            BusinessException e = assertThrows(BusinessException.class,
                    () -> service.updateThreshold(regionalA, UNDERPASS_ID, RiskLevel.WARNING, update("45")));

            assertEquals(HttpStatus.NOT_FOUND, e.getStatus());
        }

        @Test
        @DisplayName("담당 지역 임계치를 바꾸면 값이 갱신되고 이전 값→새 값 이력이 남는다")
        void update_ownRegion_updatesAndRecordsHistory() {
            givenUnderpass(REGION_A);
            Threshold current = warning("40.00");
            when(thresholdRepository.findByUnderpassIdAndLevel(UNDERPASS_ID, RiskLevel.WARNING)).thenReturn(Optional.of(current));

            service.updateThreshold(regionalA, UNDERPASS_ID, RiskLevel.WARNING, update("45.00"));

            assertEquals(new BigDecimal("45.00"), current.getRiskScoreMin());
            assertEquals(2L, current.getUpdatedBy());
            ArgumentCaptor<ThresholdHistory> captor = ArgumentCaptor.forClass(ThresholdHistory.class);
            verify(historyRepository).save(captor.capture());
            assertEquals(new BigDecimal("40.00"), captor.getValue().getOldRiskScoreMin());
            assertEquals(new BigDecimal("45.00"), captor.getValue().getNewRiskScoreMin());
            assertEquals(2L, captor.getValue().getChangedBy());
        }

        @Test
        @DisplayName("여러 지역을 담당하면 담당 지역 어디든 임계치를 바꿀 수 있다")
        void update_multiRegionManager_anyOwnRegion() {
            givenUnderpass(REGION_B);
            Threshold current = warning("40.00");
            when(thresholdRepository.findByUnderpassIdAndLevel(UNDERPASS_ID, RiskLevel.WARNING)).thenReturn(Optional.of(current));

            service.updateThreshold(managerAB, UNDERPASS_ID, RiskLevel.WARNING, update("50.00"));

            assertEquals(new BigDecimal("50.00"), current.getRiskScoreMin());
            assertEquals(1L, current.getUpdatedBy());
        }

        @Test
        @DisplayName("기본 임계치 생성 시 이력의 이전 값은 비어 있다(최초 생성)")
        void createDefaults_historyOldValueIsNull() {
            service.createDefaultThresholds(UNDERPASS_ID, 1L);

            ArgumentCaptor<ThresholdHistory> captor = ArgumentCaptor.forClass(ThresholdHistory.class);
            verify(historyRepository, times(3)).save(captor.capture());
            assertNull(captor.getAllValues().get(0).getOldRiskScoreMin());
        }
    }
}
