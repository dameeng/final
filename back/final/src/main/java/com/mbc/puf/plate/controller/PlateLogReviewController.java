package com.mbc.puf.plate.controller;

import java.util.List;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.mbc.puf.common.response.ApiResponse;
import com.mbc.puf.common.security.LoginUser;
import com.mbc.puf.plate.dto.PlateLogPendingItem;
import com.mbc.puf.plate.dto.PlateLogReviewRequest;
import com.mbc.puf.plate.dto.PlateLogReviewResponse;
import com.mbc.puf.plate.service.PlateLogReviewService;

import jakarta.validation.Valid;

/** 번호판 인식 판별대기(review_status=PENDING) 처리. 조회는 관리자 전체, 판별은 해당 지하차도 담당 지역만 */
@RestController
@RequestMapping("/api/plate-logs")
@PreAuthorize("hasAnyRole('SUPER_ADMIN', 'REGIONAL_ADMIN')")
public class PlateLogReviewController {

    private final PlateLogReviewService plateLogReviewService;

    public PlateLogReviewController(PlateLogReviewService plateLogReviewService) {
        this.plateLogReviewService = plateLogReviewService;
    }

    // 판별대기 목록 (마감 임박한 것부터). underpassId를 주면 그 지하차도 것만(대시보드 시설 선택 필터)
    @GetMapping("/pending")
    public ApiResponse<List<PlateLogPendingItem>> pending(
            @AuthenticationPrincipal LoginUser loginUser,
            @RequestParam(name = "underpassId", required = false) Long underpassId) {
        return ApiResponse.ok(plateLogReviewService.getPendingList(loginUser, underpassId));
    }

    // 수동 판별 (번호판 고쳐서 재매칭). REGIONAL_ADMIN은 본인 담당 지역 것만 가능
    @PutMapping("/{id}/review")
    public ApiResponse<PlateLogReviewResponse> review(@AuthenticationPrincipal LoginUser loginUser,
                                                        @PathVariable("id") Long id,
                                                        @Valid @RequestBody PlateLogReviewRequest request) {
        return ApiResponse.ok("판별이 완료되었습니다.", plateLogReviewService.review(loginUser, id, request));
    }
}