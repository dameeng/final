package com.mbc.puf.pm.dto;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 설비 상세: 목록 한 줄 정보 + 점수 근거 + 기준 + 권장 조치.
 * reason = 점수를 올린 항목 요약(사유). 점검 때문에 지하차도를 막아야 하면 화면은 팀 차단 API
 * POST /api/control/underpasses/{underpassId}/block 에 {"presetId": blockPresetId} 를 보내면 된다
 * (blockPresetId = reason_preset 의 '배수펌프 고장으로 인한 침수 위험' 등, 없으면 null 이고 blockReason 글자로 보내면 됨).
 */
public record PmEquipmentDetailResponse(PmEquipmentItem equipment, LocalDateTime measuredAt,
                                        List<PmReasonItem> reasons, String reason,
                                        List<PmThresholdItem> thresholds, String advice,
                                        Long blockPresetId, String blockReason) {
}
