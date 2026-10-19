package com.mbc.project;

import static com.mbc.project.TestEntities.withId;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

import com.mbc.puf.common.enums.RiskLevel;
import com.mbc.puf.common.enums.UnderpassEventType;
import com.mbc.puf.common.exception.BusinessException;
import com.mbc.puf.internal.dto.RiskScoreCreateRequest;
import com.mbc.puf.internal.dto.RiskScoreResponse;
import com.mbc.puf.internal.entity.RiskScore;
import com.mbc.puf.internal.repository.RiskScoreRepository;
import com.mbc.puf.internal.service.InternalIngestServiceImpl;
import com.mbc.puf.threshold.entity.Threshold;
import com.mbc.puf.threshold.repository.ThresholdRepository;
import com.mbc.puf.underpass.entity.Underpass;
import com.mbc.puf.underpass.entity.UnderpassEvent;
import com.mbc.puf.underpass.repository.UnderpassEventRepository;
import com.mbc.puf.underpass.repository.UnderpassRepository;

/**
 * 위험도 판정 단위 테스트 (FastAPI가 보낸 점수 → 임계치 비교 → 단계 갱신 + 이벤트 기록).
 * 대상: InternalIngestServiceImpl.receiveRiskScore
 * 기본 임계치: 안전 0 / 주의 40 / 위험 70 (점수 이상이면 해당 단계)
 * JPA라 "단계 갱신"은 UPDATE 호출이 아니라 엔티티 값 변경이므로, 엔티티의 현재 단계를 직접 확인한다
 */
@ExtendWith(MockitoExtension.class)
class RiskLevelJudgeTest {

    private static final Long UNDERPASS_ID = 1L;

    @Mock private RiskScoreRepository riskScoreRepository;
    @Mock private UnderpassRepository underpassRepository;
    @Mock private UnderpassEventRepository eventRepository;
    @Mock private ThresholdRepository thresholdRepository;
    // 이 테스트에서 직접 쓰지 않지만 서비스 생성자에 필요한 의존성
    @Mock private com.mbc.puf.plate.repository.PlateLogRepository plateLogRepository;
    @Mock private com.mbc.puf.underpass.repository.TransitRepository transitRepository;
    @Mock private com.mbc.puf.underpass.repository.CameraRepository cameraRepository;
    @Mock private com.mbc.puf.car.repository.CarRepository carRepository;
    @Mock private com.mbc.puf.alert.service.AlertService alertService;

    @InjectMocks
    private InternalIngestServiceImpl service;

    private RiskScoreCreateRequest request(String score) {
        RiskScoreCreateRequest r = new RiskScoreCreateRequest();
        r.setUnderpassId(UNDERPASS_ID);
        r.setRiskScore(new BigDecimal(score));
        r.setPredictedAt(LocalDateTime.of(2026, 10, 3, 12, 0));
        return r;
    }

    private Threshold threshold(RiskLevel level, String min) {
        Threshold t = new Threshold();
        t.setUnderpassId(UNDERPASS_ID);
        t.setLevel(level);
        t.setRiskScoreMin(new BigDecimal(min));
        return t;
    }

    private void givenThresholds() {
        when(thresholdRepository.findByUnderpassIdOrderByRiskScoreMinAsc(UNDERPASS_ID)).thenReturn(List.of(
                threshold(RiskLevel.SAFE, "0.00"),
                threshold(RiskLevel.WARNING, "40.00"),
                threshold(RiskLevel.DANGER, "70.00")));
    }

    private Underpass givenUnderpassExistsWithLevel(RiskLevel current) {
        Underpass u = withId(new Underpass(), UNDERPASS_ID);
        u.setCurrentRiskLevel(current);
        when(underpassRepository.findByIdAndDeletedFalse(UNDERPASS_ID)).thenReturn(Optional.of(u));
        return u;
    }

    private UnderpassEvent savedEvent() {
        ArgumentCaptor<UnderpassEvent> captor = ArgumentCaptor.forClass(UnderpassEvent.class);
        verify(eventRepository).save(captor.capture());
        return captor.getValue();
    }

    @Test
    @DisplayName("존재하지 않는 지하차도면 400으로 거절하고 아무것도 저장하지 않는다")
    void unknownUnderpass_isRejected() {
        when(underpassRepository.findByIdAndDeletedFalse(UNDERPASS_ID)).thenReturn(Optional.empty());

        BusinessException e = assertThrows(BusinessException.class, () -> service.receiveRiskScore(request("50")));

        assertEquals(HttpStatus.BAD_REQUEST, e.getStatus());
        verify(riskScoreRepository, never()).save(any(RiskScore.class));
    }

    @Test
    @DisplayName("점수 39.99는 주의 아래(안전)이고, 이미 안전이면 이벤트를 남기지 않는다")
    void justBelowWarning_staysSafe_noEvent() {
        Underpass u = givenUnderpassExistsWithLevel(RiskLevel.SAFE);
        givenThresholds();

        RiskScoreResponse response = service.receiveRiskScore(request("39.99"));

        assertEquals(new BigDecimal("39.99"), response.getRiskScore());
        verify(riskScoreRepository).save(any(RiskScore.class));   // 점수 기록은 항상 남는다
        assertEquals(RiskLevel.SAFE, u.getCurrentRiskLevel());
        verify(eventRepository, never()).save(any(UnderpassEvent.class));
    }

    @Test
    @DisplayName("점수가 정확히 40이면(경계값) 주의로 올라가고 RISK_LEVEL_UP 이벤트가 남는다")
    void exactlyWarningBoundary_becomesWarning() {
        Underpass u = givenUnderpassExistsWithLevel(RiskLevel.SAFE);
        givenThresholds();

        service.receiveRiskScore(request("40.00"));

        assertEquals(RiskLevel.WARNING, u.getCurrentRiskLevel());
        UnderpassEvent event = savedEvent();
        assertEquals(UnderpassEventType.RISK_LEVEL_UP, event.getEventType());
        assertEquals(RiskLevel.WARNING, event.getRiskLevel());
        assertEquals(new BigDecimal("40.00"), event.getRiskScoreAtEvent());
    }

    @Test
    @DisplayName("점수가 70 이상이면 위험으로 올라간다")
    void atDangerBoundary_becomesDanger() {
        Underpass u = givenUnderpassExistsWithLevel(RiskLevel.WARNING);
        givenThresholds();

        service.receiveRiskScore(request("70.00"));

        assertEquals(RiskLevel.DANGER, u.getCurrentRiskLevel());
    }

    @Test
    @DisplayName("위험에서 점수가 내려가 주의가 되면 RISK_LEVEL_DOWN 이벤트가 남는다")
    void dropFromDangerToWarning_recordsDown() {
        Underpass u = givenUnderpassExistsWithLevel(RiskLevel.DANGER);
        givenThresholds();

        service.receiveRiskScore(request("55.5"));

        assertEquals(RiskLevel.WARNING, u.getCurrentRiskLevel());
        assertEquals(UnderpassEventType.RISK_LEVEL_DOWN, savedEvent().getEventType());
    }

    @Test
    @DisplayName("단계가 그대로면(주의 → 주의) 상태 갱신도 이벤트도 없다 (이벤트 남발 방지)")
    void sameLevel_noUpdateNoEvent() {
        Underpass u = givenUnderpassExistsWithLevel(RiskLevel.WARNING);
        givenThresholds();

        service.receiveRiskScore(request("60"));

        assertEquals(RiskLevel.WARNING, u.getCurrentRiskLevel());
        verify(eventRepository, never()).save(any(UnderpassEvent.class));
    }

    @Test
    @DisplayName("점수 0이면 안전 (임계치 최저값 이상)")
    void zeroScore_isSafe() {
        Underpass u = givenUnderpassExistsWithLevel(RiskLevel.WARNING);
        givenThresholds();

        service.receiveRiskScore(request("0"));

        assertEquals(RiskLevel.SAFE, u.getCurrentRiskLevel());
    }

    @Test
    @DisplayName("관리자가 임계치를 바꾸면(주의 50) 바뀐 값을 기준으로 판정한다")
    void customThreshold_isRespected() {
        Underpass u = givenUnderpassExistsWithLevel(RiskLevel.SAFE);
        when(thresholdRepository.findByUnderpassIdOrderByRiskScoreMinAsc(UNDERPASS_ID)).thenReturn(List.of(
                threshold(RiskLevel.SAFE, "0.00"),
                threshold(RiskLevel.WARNING, "50.00"),
                threshold(RiskLevel.DANGER, "80.00")));

        service.receiveRiskScore(request("45"));   // 기본(40)이면 주의지만 50으로 바뀌어 안전

        assertEquals(RiskLevel.SAFE, u.getCurrentRiskLevel());
        verify(eventRepository, never()).save(any(UnderpassEvent.class));
    }
}
