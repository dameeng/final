package com.mbc.puf.pm.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import tools.jackson.databind.JsonNode;

/** 예지보전 설비 상세 (GET /api/pm/equipments/{id}) */
public class PmEquipmentDetailResponse {

    private final PmEquipmentListItem equipment;   // 목록과 같은 기본 정보 (코드·종류·지하차도·최근 점수·단계·사유·점검 상태)
    private final JsonNode detail;                 // 판단 근거 (최근 점수의 모델별 세부값. CCTV items / 펌프 topSignals / 전광판 suspectedCause / 수위 anomalyType)
    private final BigDecimal cautionMin;           // 이 설비의 주의 기준 점수
    private final BigDecimal dangerMin;            // 이 설비의 위험 기준 점수
    private final LocalDateTime lastCheckedAt;     // 최근 점검일 (마지막 조치 기록 시각)
    private final List<PmActionItem> recentActions;   // 최근 점검 이력 (최대 5건)

    public PmEquipmentDetailResponse(PmEquipmentListItem equipment, JsonNode detail, BigDecimal cautionMin,
                                     BigDecimal dangerMin, LocalDateTime lastCheckedAt, List<PmActionItem> recentActions) {
        this.equipment = equipment;
        this.detail = detail;
        this.cautionMin = cautionMin;
        this.dangerMin = dangerMin;
        this.lastCheckedAt = lastCheckedAt;
        this.recentActions = recentActions;
    }

    public PmEquipmentListItem getEquipment() { return equipment; }
    public JsonNode getDetail() { return detail; }
    public BigDecimal getCautionMin() { return cautionMin; }
    public BigDecimal getDangerMin() { return dangerMin; }
    public LocalDateTime getLastCheckedAt() { return lastCheckedAt; }
    public List<PmActionItem> getRecentActions() { return recentActions; }
}
