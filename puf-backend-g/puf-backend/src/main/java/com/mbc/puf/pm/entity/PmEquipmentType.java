package com.mbc.puf.pm.entity;

/** 예지보전 설비 종류 (DB: pm_equipment_type). 화면 표시용 한글 이름과 설비 코드 앞글자를 함께 가진다 */
public enum PmEquipmentType {
    CCTV("CCTV", "C"),
    DISPLAY("전광판", "D"),
    PUMP("배수펌프", "P");

    private final String label;
    private final String codePrefix;

    PmEquipmentType(String label, String codePrefix) {
        this.label = label;
        this.codePrefix = codePrefix;
    }

    public String getLabel() {
        return label;
    }

    public String getCodePrefix() {
        return codePrefix;
    }
}
