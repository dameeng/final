package com.mbc.puf.board.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.mbc.puf.board.dto.FaqCreateRequest;
import com.mbc.puf.board.dto.FaqDetailResponse;
import com.mbc.puf.board.dto.FaqListItem;
import com.mbc.puf.board.dto.FaqUpdateRequest;
import com.mbc.puf.board.service.FaqService;
import com.mbc.puf.common.response.ApiResponse;
import com.mbc.puf.common.response.PageResponse;
import com.mbc.puf.common.security.LoginUser;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/faqs")
public class FaqController {

    private final FaqService faqService;

    public FaqController(FaqService faqService) {
        this.faqService = faqService;
    }

    // FAQ 목록 (로그인 불필요). keyword: 질문+답변 통합 검색 (없으면 전체)
    @GetMapping
    public ApiResponse<PageResponse<FaqListItem>> list(
            @RequestParam(name = "keyword", required = false) String keyword,
            @RequestParam(name = "page", defaultValue = "1") int page,
            @RequestParam(name = "size", defaultValue = "20") int size) {
        return ApiResponse.ok(faqService.getFaqList(keyword, page, size));
    }

    // FAQ 상세 (로그인 불필요)
    @GetMapping("/{id}")
    public ApiResponse<FaqDetailResponse> detail(@PathVariable("id") Long id) {
        return ApiResponse.ok(faqService.getFaq(id));
    }

    // FAQ 등록 (201 Created) - 관리자 전용
    @PostMapping
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'REGIONAL_ADMIN')")
    public ResponseEntity<ApiResponse<FaqDetailResponse>> create(
            @AuthenticationPrincipal LoginUser loginUser,
            @Valid @RequestBody FaqCreateRequest request) {
        FaqDetailResponse created = faqService.createFaq(loginUser.id(), request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("FAQ가 등록되었습니다.", created));
    }

    // FAQ 수정 - 관리자 전용
    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'REGIONAL_ADMIN')")
    public ApiResponse<FaqDetailResponse> update(
            @PathVariable("id") Long id,
            @Valid @RequestBody FaqUpdateRequest request) {
        return ApiResponse.ok("FAQ가 수정되었습니다.", faqService.updateFaq(id, request));
    }

    // FAQ 삭제 (소프트 삭제) - 관리자 전용
    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'REGIONAL_ADMIN')")
    public ApiResponse<Void> delete(@PathVariable("id") Long id) {
        faqService.deleteFaq(id);
        return ApiResponse.ok("FAQ가 삭제되었습니다.", null);
    }
}
