package com.mbc.puf.pm.dto;

/** 예지보전 서버가 받아 가는 설비 1건 (GET /api/internal/pm/equipments) */
public class PmInternalEquipmentItem {

    private final Long equipId;
    private final String type;            // CCTV / DISPLAY / PUMP / WATER_LEVEL
    private final Long underpassId;
    private final String underpassName;   // 예지보전 서버가 시연 대상(DEMO_TARGETS)을 이름으로 찾는다

    public PmInternalEquipmentItem(Long equipId, String type, Long underpassId, String underpassName) {
        this.equipId = equipId;
        this.type = type;
        this.underpassId = underpassId;
        this.underpassName = underpassName;
    }

    public Long getEquipId() {
        return equipId;
    }

    public String getType() {
        return type;
    }

    public Long getUnderpassId() {
        return underpassId;
    }

    public String getUnderpassName() {
        return underpassName;
    }
}
