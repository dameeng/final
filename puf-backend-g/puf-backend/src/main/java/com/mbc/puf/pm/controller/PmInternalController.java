package com.mbc.puf.pm.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.mbc.puf.common.response.ApiResponse;
import com.mbc.puf.pm.dto.PmInternalEquipmentItem;
import com.mbc.puf.pm.dto.PmScoreIngestRequest;
import com.mbc.puf.pm.dto.PmScoreIngestResponse;
import com.mbc.puf.pm.service.PmIngestService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

/**
 * 예지보전 서버(FastAPI 8002)가 호출하는 내부 API. InternalController 와 같이 X-Internal-Api-Key 헤더로 인증하며,
 * 그 검사는 InternalApiKeyInterceptor(WebConfigurer 에 /api/internal/** 로 등록)가 담당한다.
 */
@Tag(name = "내부 수신(예지보전)", description = "X-Internal-Api-Key 헤더로 인증. 예지보전 서버가 설비 목록을 받아 가고 점수를 보낸다")
@RestController
@RequestMapping("/api/internal")
public class PmInternalController {

    private final PmIngestService pmIngestService;

    public PmInternalController(PmIngestService pmIngestService) {
        this.pmIngestService = pmIngestService;
    }

    @Operation(summary = "예지보전 설비 목록", description = "삭제되지 않은 지하차도의 전체 설비. 예지보전 서버가 시연 대상 지하차도를 이름으로 찾는다.")
    @GetMapping("/pm/equipments")
    public ApiResponse<List<PmInternalEquipmentItem>> equipments() {
        return ApiResponse.ok(pmIngestService.getEquipments());
    }

    @Operation(summary = "예지보전 점수 수신 (묶음)", description = "점수를 저장하고 설비 임계치로 단계를 판정한다. 같은 설비·같은 시각은 건너뛴다. "
            + "backfill=false 이면 주의 이상일 때 점검 이벤트·관리자 알림·SSE(pm-update)가 나간다(201). "
            + "처리 중인 이벤트가 있으면 새로 만들지 않고 단계가 오를 때만 올린다.")
    @PostMapping("/pm-scores")
    public ResponseEntity<ApiResponse<PmScoreIngestResponse>> receiveScores(@Valid @RequestBody PmScoreIngestRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(pmIngestService.receiveScores(request)));
    }
}
