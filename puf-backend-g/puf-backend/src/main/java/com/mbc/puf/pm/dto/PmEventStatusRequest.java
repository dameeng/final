package com.mbc.puf.pm.dto;

import com.mbc.puf.pm.entity.PmEventStatus;

import jakarta.validation.constraints.NotNull;

/** 점검 대상 상태 바꾸기 (확인필요 → 점검중 → 조치완료/기타) */
public record PmEventStatusRequest(@NotNull(message = "바꿀 상태를 입력하세요.") PmEventStatus status) {
}
