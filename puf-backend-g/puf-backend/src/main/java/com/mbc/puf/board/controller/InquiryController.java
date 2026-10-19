package com.mbc.puf.board.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.mbc.puf.board.dto.InquiryCreateRequest;
import com.mbc.puf.board.dto.InquiryDetailResponse;
import com.mbc.puf.board.dto.InquiryListItem;
import com.mbc.puf.board.service.InquiryService;
import com.mbc.puf.common.response.ApiResponse;
import com.mbc.puf.common.response.PageResponse;
import com.mbc.puf.common.security.LoginUser;

import jakarta.validation.Valid;

/** 고객 마이페이지의 1:1 문의(CP-03). 전부 본인 문의만 다룬다 */
@RestController
@RequestMapping("/api/customers/me/inquiries")
@PreAuthorize("hasRole('CUSTOMER')")
public class InquiryController {

    private final InquiryService inquiryService;

    public InquiryController(InquiryService inquiryService) {
        this.inquiryService = inquiryService;
    }

    @GetMapping
    public ApiResponse<PageResponse<InquiryListItem>> list(
            @AuthenticationPrincipal LoginUser loginUser,
            @RequestParam(name = "page", defaultValue = "1") int page,
            @RequestParam(name = "size", defaultValue = "20") int size) {
        return ApiResponse.ok(inquiryService.getMyInquiries(loginUser.id(), page, size));
    }

    @GetMapping("/{id}")
    public ApiResponse<InquiryDetailResponse> detail(@AuthenticationPrincipal LoginUser loginUser,
                                                      @PathVariable("id") Long id) {
        return ApiResponse.ok(inquiryService.getMyInquiry(loginUser.id(), id));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<InquiryDetailResponse>> create(
            @AuthenticationPrincipal LoginUser loginUser,
            @Valid @RequestBody InquiryCreateRequest request) {
        InquiryDetailResponse created = inquiryService.createInquiry(loginUser.id(), request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("문의가 등록되었습니다.", created));
    }
}