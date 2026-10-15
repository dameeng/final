package com.mbc.project;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

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
import com.mbc.puf.internal.dao.RiskScoreDao;
import com.mbc.puf.internal.dto.RiskScore;
import com.mbc.puf.internal.dto.RiskScoreCreateRequest;
import com.mbc.puf.internal.dto.RiskScoreResponse;
import com.mbc.puf.internal.service.InternalIngestServiceImpl;
import com.mbc.puf.threshold.dao.ThresholdDao;
import com.mbc.puf.threshold.dto.Threshold;
import com.mbc.puf.underpass.dao.UnderpassDao;
import com.mbc.puf.underpass.dao.UnderpassEventDao;
import com.mbc.puf.underpass.dto.UnderpassDetailResponse;
import com.mbc.puf.underpass.dto.UnderpassEvent;

/**
 * 위험도 판정 단위 테스트 (FastAPI가 보낸 점수 → 임계치 비교 → 단계 갱신 + 이벤트 기록).
 * 대상: InternalIngestServiceImpl.receiveRiskScore
 * 기본 임계치: 안전 0 / 경고 40 / 위험 70 (점수 이상이면 해당 단계)
 */
@ExtendWith(MockitoExtension.class)
class RiskLevelJudgeTest {

    private static final Long UNDERPASS_ID = 1L;

    @Mock private RiskScoreDao riskScoreDao;
    @Mock private UnderpassDao underpassDao;
    @Mock private UnderpassEventDao underpassEventDao;
    @Mock private ThresholdDao thresholdDao;
    // 이 테스트에서 직접 쓰지 않지만 서비스 생성자에 필요한 의존성
    @Mock private com.mbc.puf.internal.dao.PlateLogDao plateLogDao;
    @Mock private com.mbc.puf.underpass.dao.UnderpassTransitDao underpassTransitDao;
    @Mock private com.mbc.puf.underpass.dao.CameraDao cameraDao;
    @Mock private com.mbc.puf.car.dao.CarDao carDao;
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
        when(thresholdDao.selectThresholdsByUnderpassId(UNDERPASS_ID)).thenReturn(List.of(
                threshold(RiskLevel.SAFE, "0.00"),
                threshold(RiskLevel.WARNING, "40.00"),
                threshold(RiskLevel.DANGER, "70.00")));
    }

    private void givenUnderpassExistsWithLevel(RiskLevel current) {
        when(underpassDao.selectUnderpassById(UNDERPASS_ID)).thenReturn(new UnderpassDetailResponse());
        when(underpassDao.selectCurrentRiskLevel(UNDERPASS_ID)).thenReturn(current);
    }

    @Test
    @DisplayName("존재하지 않는 지하차도면 400으로 거절하고 아무것도 저장하지 않는다")
    void unknownUnderpass_isRejected() {
        when(underpassDao.selectUnderpassById(UNDERPASS_ID)).thenReturn(null);

        BusinessException e = assertThrows(BusinessException.class, () -> service.receiveRiskScore(request("50")));

        assertEquals(HttpStatus.BAD_REQUEST, e.getStatus());
        verify(riskScoreDao, never()).insertRiskScore(any(RiskScore.class));
    }

    @Test
    @DisplayName("점수 39.99는 경고 아래(안전)이고, 이미 안전이면 이벤트를 남기지 않는다")
    void justBelowWarning_staysSafe_noEvent() {
        givenUnderpassExistsWithLevel(RiskLevel.SAFE);
        givenThresholds();

        RiskScoreResponse response = service.receiveRiskScore(request("39.99"));

        assertEquals(new BigDecimal("39.99"), response.getRiskScore());
        verify(riskScoreDao).insertRiskScore(any(RiskScore.class));   // 점수 기록은 항상 남는다
        verify(underpassDao, never()).updateCurrentRiskLevel(eq(UNDERPASS_ID), any(RiskLevel.class));
        verify(underpassEventDao, never()).insertUnderpassEvent(any(UnderpassEvent.class));
    }

    @Test
    @DisplayName("점수가 정확히 40이면(경계값) 경고로 올라가고 RISK_LEVEL_UP 이벤트가 남는다")
    void exactlyWarningBoundary_becomesWarning() {
        givenUnderpassExistsWithLevel(RiskLevel.SAFE);
        givenThresholds();

        service.receiveRiskScore(request("40.00"));

        verify(underpassDao).updateCurrentRiskLevel(UNDERPASS_ID, RiskLevel.WARNING);
        ArgumentCaptor<UnderpassEvent> captor = ArgumentCaptor.forClass(UnderpassEvent.class);
        verify(underpassEventDao).insertUnderpassEvent(captor.capture());
        assertEquals(UnderpassEventType.RISK_LEVEL_UP, captor.getValue().getEventType());
        assertEquals(RiskLevel.WARNING, captor.getValue().getRiskLevel());
        assertEquals(new BigDecimal("40.00"), captor.getValue().getRiskScoreAtEvent());
    }

    @Test
    @DisplayName("점수가 70 이상이면 위험으로 올라간다")
    void atDangerBoundary_becomesDanger() {
        givenUnderpassExistsWithLevel(RiskLevel.WARNING);
        givenThresholds();

        service.receiveRiskScore(request("70.00"));

        verify(underpassDao).updateCurrentRiskLevel(UNDERPASS_ID, RiskLevel.DANGER);
    }

    @Test
    @DisplayName("위험에서 점수가 내려가 경고가 되면 RISK_LEVEL_DOWN 이벤트가 남는다")
    void dropFromDangerToWarning_recordsDown() {
        givenUnderpassExistsWithLevel(RiskLevel.DANGER);
        givenThresholds();

        service.receiveRiskScore(request("55.5"));

        verify(underpassDao).updateCurrentRiskLevel(UNDERPASS_ID, RiskLevel.WARNING);
        ArgumentCaptor<UnderpassEvent> captor = ArgumentCaptor.forClass(UnderpassEvent.class);
        verify(underpassEventDao).insertUnderpassEvent(captor.capture());
        assertEquals(UnderpassEventType.RISK_LEVEL_DOWN, captor.getValue().getEventType());
    }

    @Test
    @DisplayName("단계가 그대로면(경고 → 경고) 상태 갱신도 이벤트도 없다 (이벤트 남발 방지)")
    void sameLevel_noUpdateNoEvent() {
        givenUnderpassExistsWithLevel(RiskLevel.WARNING);
        givenThresholds();

        service.receiveRiskScore(request("60"));

        verify(underpassDao, never()).updateCurrentRiskLevel(eq(UNDERPASS_ID), any(RiskLevel.class));
        verify(underpassEventDao, never()).insertUnderpassEvent(any(UnderpassEvent.class));
    }

    @Test
    @DisplayName("점수 0이면 안전 (임계치 최저값 이상)")
    void zeroScore_isSafe() {
        givenUnderpassExistsWithLevel(RiskLevel.WARNING);
        givenThresholds();

        service.receiveRiskScore(request("0"));

        verify(underpassDao).updateCurrentRiskLevel(UNDERPASS_ID, RiskLevel.SAFE);
    }

    @Test
    @DisplayName("관리자가 임계치를 바꾸면(경고 50) 바뀐 값을 기준으로 판정한다")
    void customThreshold_isRespected() {
        givenUnderpassExistsWithLevel(RiskLevel.SAFE);
        when(thresholdDao.selectThresholdsByUnderpassId(UNDERPASS_ID)).thenReturn(List.of(
                threshold(RiskLevel.SAFE, "0.00"),
                threshold(RiskLevel.WARNING, "50.00"),
                threshold(RiskLevel.DANGER, "80.00")));

        service.receiveRiskScore(request("45"));   // 기본(40)이면 경고지만 50으로 바뀌어 안전

        verify(underpassDao, never()).updateCurrentRiskLevel(eq(UNDERPASS_ID), any(RiskLevel.class));
    }
}
