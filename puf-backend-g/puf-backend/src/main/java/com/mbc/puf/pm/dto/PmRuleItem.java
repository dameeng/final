package com.mbc.puf.pm.dto;

import java.util.List;

import com.mbc.puf.pm.entity.PmEquipmentType;
import com.mbc.puf.pm.service.PmRules;

/** 설비 종류별 점수 규칙 (기준 설정 화면 표시용, 읽기 전용) */
public record PmRuleItem(PmEquipmentType type, String typeLabel, List<PmRules.Rule> rules) {
}
