package com.mbc.puf.pm.dto;

import com.mbc.puf.pm.entity.PmEventStatus;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** 조치 등록. status 를 같이 주면 상태도 함께 바꾼다 (예: RESOLVED = 조치 완료) */
public record PmActionCreateRequest(
        @NotBlank(message = "조치 내용을 입력하세요.")
        @Size(max = 1000, message = "조치 내용은 1000자 이하로 입력하세요.")
        String content,
        PmEventStatus status) {
}
