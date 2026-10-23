package com.mbc.puf.handover.dto;

import java.time.LocalDateTime;
import java.util.List;

import com.mbc.puf.common.enums.RiskLevel;
import com.mbc.puf.pm.dto.PmPeriodSummary;

/**
 * 인수인계 자동 집계. 작성하는 순간의 스냅샷이 shift_handover.summary 에 JSON 으로 저장된다.
 *  - counts      : 그 근무 시간대에 일어난 일 건수 (프런트 팝업의 통제 / 위험 상승 / 점검 / 미처리 점검)
 *  - blockedNow  : 작성 시점에 아직 차단 중인 지하차도,  elevatedNow : 차단은 아니지만 위험 단계가 안전이 아닌 지하차도 (다음 근무조가 이어받을 것)
 *  - pm          : 예지보전 요약 (단계별 설비 수, 신규 점검 대기, 점검 기록, 처리 중인 점검 = 이월, 데이터 미수신)
 *  - activities  : 시간 역순 업무 기록 (통제·위험 단계 변화·점검 대기 발생·점검 기록)
 */
public record HandoverSummary(
        LocalDateTime windowStart,
        LocalDateTime windowEnd,
        Counts counts,
        List<UnderpassState> blockedNow,
        List<UnderpassState> elevatedNow,
        PmPeriodSummary pm,
        List<Activity> activities) {

    /**
     * block 통제 시작 / release 통제 해제 / riskUp 위험 단계 상승 / riskDown 하강 /
     * pmNew 새 점검 대기 / pmChecked 점검 기록 / pmPending 지금 처리 중인 점검
     */
    public record Counts(int block, int release, int riskUp, int riskDown, int pmNew, int pmChecked, int pmPending) {
    }

    public record UnderpassState(Long underpassId, String name, RiskLevel riskLevel) {
    }

    /** category: 통제 / 위험 / 설비 / 점검 */
    public record Activity(LocalDateTime at, String category, String content) {
    }
}
