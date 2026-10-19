package com.mbc.puf.common.enums;

/** 위험도 단계 (DB: risk_level) */
public enum RiskLevel implements DbEnum {
    SAFE("안전"),
    WARNING("주의"),
    DANGER("위험");

    private final String dbValue;

    RiskLevel(String dbValue) {
        this.dbValue = dbValue;
    }

    @Override
    public String getDbValue() {
        return dbValue;
    }
}
