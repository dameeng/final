package com.mbc.puf.pm.entity;

import com.mbc.puf.common.jpa.DbEnums;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

/** PmLevel ↔ DB pm_level('안전'/'주의'/'위험') 변환. autoApply 라서 엔티티 필드에 따로 붙이지 않아도 된다 */
@Converter(autoApply = true)
public class PmLevelConverter implements AttributeConverter<PmLevel, String> {

    @Override
    public String convertToDatabaseColumn(PmLevel level) {
        return level == null ? null : level.getDbValue();
    }

    @Override
    public PmLevel convertToEntityAttribute(String dbValue) {
        return DbEnums.fromDbValue(PmLevel.class, dbValue);
    }
}
