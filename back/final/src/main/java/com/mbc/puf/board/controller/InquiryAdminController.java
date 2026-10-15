package com.mbc.puf.board.controller;

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

import com.mbc.puf.board.dto.InquiryDetailResponse;
import com.mbc.puf.board.dto.InquiryListItem;
import com.mbc.puf.board.dto.InquiryReplyRequest;
import com.mbc.puf.board.service.InquiryService;
import com.mbc.puf.common.enums.InquiryStatus;
import com.mbc.puf.common.response.ApiResponse;
import com.mbc.puf.common.response.PageResponse;
import com.mbc.puf.common.security.LoginUser;

import jakarta.validation.Valid;

/** 접수의견 처리(MP-13). 관리자 전용, 모든 고객의 문의를 다룬다 */
@RestController
@RequestMapping("/api/inquiries")
@PreAuthorize("hasAnyRole('SUPER_ADMIN', 'REGIONAL_ADMIN')")
public class InquiryAdminController {

    private final InquiryService inquiryService;

    public InquiryAdminController(InquiryService inquiryService) {
        this.inquiryService = inquiryService;
    }

    // 원글 목록. keyword: 제목+내용 통합 검색, status: PENDING/ANSWERED 필터 (안 주면 전체)
    @GetMapping
    public ApiResponse<PageResponse<InquiryListItem>> list(
            @RequestParam(name = "keyword", required = false) String keyword,
            @RequestParam(name = "status", required = false) InquiryStatus status,
            @RequestParam(name = "page", defaultValue = "1") int page,
            @RequestParam(name = "size", defaultValue = "20") int size) {
        return ApiResponse.ok(inquiryService.getInquiryListForAdmin(keyword, status, page, size));
    }

    // 원글+답글 상세
    @GetMapping("/{id}")
    public ApiResponse<InquiryDetailResponse> detail(@PathVariable("id") Long id) {
        return ApiResponse.ok(inquiryService.getInquiryForAdmin(id));
    }

    // 답변 작성. 이미 답변된 문의면 409
    @PostMapping("/{id}/reply")
    public ApiResponse<Void> reply(@AuthenticationPrincipal LoginUser loginUser,
                                    @PathVariable("id") Long id,
                                    @Valid @RequestBody InquiryReplyRequest request) {
        inquiryService.reply(id, loginUser.id(), request);
        return ApiResponse.ok("답변이 등록되었습니다.", null);
    }

    // 답변 수정. 아직 답변이 없으면(PENDING) 409
    @PutMapping("/{id}/reply")
    public ApiResponse<Void> updateReply(@PathVariable("id") Long id,
                                         @Valid @RequestBody InquiryReplyRequest request) {
        inquiryService.updateReply(id, request);
        return ApiResponse.ok("답변이 수정되었습니다.", null);
    }

    // 답변 삭제. 원글이 다시 답변대기(PENDING) 상태로 돌아가 재답변이 가능해진다
    @DeleteMapping("/{id}/reply")
    public ApiResponse<Void> deleteReply(@PathVariable("id") Long id) {
        inquiryService.deleteReply(id);
        return ApiResponse.ok("답변이 삭제되었습니다.", null);
    }
}