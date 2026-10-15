package com.mbc.puf.internal.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.mbc.puf.common.response.ApiResponse;
import com.mbc.puf.internal.dto.PlateLogCreateRequest;
import com.mbc.puf.internal.dto.PlateLogResponse;
import com.mbc.puf.internal.dto.RiskScoreCreateRequest;
import com.mbc.puf.internal.dto.RiskScoreResponse;
import com.mbc.puf.internal.service.InternalIngestService;

import jakarta.validation.Valid;

/**
 * FastAPI가 호출하는 내부 API. 세션 인증이 아니라 X-Internal-Api-Key 헤더로 인증하며,
 * 그 검사는 InternalApiKeyInterceptor(WebConfigurer에 등록)가 담당한다 —
 * SecurityConfig에서 이 경로는 permitAll로 열려 있는 대신 인터셉터가 대신 막는 구조
 */
@RestController
@RequestMapping("/api/internal")
public class InternalController {

    private final InternalIngestService internalIngestService;

    public InternalController(InternalIngestService internalIngestService) {
        this.internalIngestService = internalIngestService;
    }

    // 위험도 예측 결과 수신
    @PostMapping("/risk-scores")
    public ResponseEntity<ApiResponse<RiskScoreResponse>> receiveRiskScore(
            @Valid @RequestBody RiskScoreCreateRequest request) {
        RiskScoreResponse response = internalIngestService.receiveRiskScore(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(response));
    }

    // 번호판 인식 결과 수신. multipart/form-data로 받는다 —
    // "request" 파트(JSON, PlateLogCreateRequest)는 필수, "image" 파트(감지 순간 캡처 이미지)는 선택
    @PostMapping(value = "/plate-logs", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<PlateLogResponse>> receivePlateLog(
            @Valid @RequestPart("request") PlateLogCreateRequest request,
            @RequestPart(value = "image", required = false) MultipartFile image) {
        PlateLogResponse response = internalIngestService.receivePlateLog(request, image);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(response));
    }

    // 헬스체크. 저장용 테이블이 없어 우선 200 응답만 반환 (계약 3-3)
    @GetMapping("/health")
    public ApiResponse<Void> health() {
        return ApiResponse.ok("OK", null);
    }
}