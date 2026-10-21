package com.mbc.puf.pm.controller;

import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.mbc.puf.common.response.ApiResponse;
import com.mbc.puf.pm.dto.PmSensorIngestRequest;
import com.mbc.puf.pm.dto.PmSensorIngestResponse;
import com.mbc.puf.pm.service.PmScoringService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

/**
 * 예지보전 내부 API (FastAPI·센서·시연 도구 → 스프링). /api/internal/** 라서
 * 로그인 대신 X-Internal-Api-Key 헤더로 검사한다 (팀 InternalApiKeyInterceptor).
 */
@Tag(name = "예지보전 내부")
@RestController
@RequestMapping("/api/internal/pm")
public class PmInternalController {

    private final PmScoringService scoringService;

    public PmInternalController(PmScoringService scoringService) {
        this.scoringService = scoringService;
    }

    @Operation(summary = "측정값 넣기", description = "넣자마자 점수 계산 → 주의 이상이면 점검 대상 + 관리자 알림")
    @PostMapping("/sensors")
    public ApiResponse<PmSensorIngestResponse> ingest(@Valid @RequestBody PmSensorIngestRequest request) {
        return ApiResponse.ok("측정값이 저장되었습니다.", scoringService.ingest(request));
    }

    @Operation(summary = "점수 지금 계산", description = "1분 주기를 기다리지 않고 바로 계산 (시연용)")
    @PostMapping("/score")
    public ApiResponse<Integer> scoreNow() {
        return ApiResponse.ok("점수를 계산했습니다.", scoringService.scoreUnscored());
    }
}
