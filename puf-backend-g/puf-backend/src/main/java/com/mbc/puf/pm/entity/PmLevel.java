package com.mbc.puf.pm.entity;

import com.mbc.puf.common.enums.DbEnum;

/**
 * 예지보전 설비 단계 (DB: pm_level '안전'/'주의'/'위험'). 침수 위험도 5단계(RiskLevel)와는 별개다.
 * 순서가 중요하다(ordinal 이 클수록 위험) — 상수 순서를 바꾸지 말 것.
 */
public enum PmLevel implements DbEnum {
    SAFE("안전"),
    CAUTION("주의"),
    DANGER("위험");

    private final String dbValue;

    PmLevel(String dbValue) {
        this.dbValue = dbValue;
    }

    @Override
    public String getDbValue() {
        return dbValue;
    }

    public boolean atLeast(PmLevel other) {
        return this.ordinal() >= other.ordinal();
    }
}
