package com.mbc.puf.pm.dto;

import com.mbc.puf.common.enums.PmEquipmentType;

/** 화면에 보이는 설비 코드 (DB 컬럼 없이 종류 + 설비 id 로 만든다). 예) 배수펌프 2번 → P-02 */
public final class PmCodes {

    private PmCodes() {
    }

    public static String code(PmEquipmentType type, Long equipId) {
        if (type == null || equipId == null) {
            return null;
        }
        String prefix = switch (type) {
            case CCTV -> "C";
            case DISPLAY -> "D";
            case PUMP -> "P";
            case WATER_LEVEL -> "W";
        };
        return String.format("%s-%02d", prefix, equipId);
    }
}
