package com.mbc.puf.member.controller;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.mbc.puf.common.response.ApiResponse;
import com.mbc.puf.common.response.PageResponse;
import com.mbc.puf.member.dto.CustomerListItem;
import com.mbc.puf.member.dto.CustomerProfileUpdateRequest;
import com.mbc.puf.member.service.CustomerSearchService;

import jakarta.validation.Valid;

/** 관리자 화면용 고객 조회·관리 (MP-12. 민원 처리에 고객 정보가 필요하다) */
@RestController
@RequestMapping("/api/customers")
@PreAuthorize("hasRole('REGIONAL_ADMIN')")
public class CustomerSearchController {

    private final CustomerSearchService customerSearchService;

    public CustomerSearchController(CustomerSearchService customerSearchService) {
        this.customerSearchService = customerSearchService;
    }

    /**
     * 고객 목록.
     *  keyword          : 아이디·이름·이메일·전화번호·차량번호 통합 검색 (일치하는 항목이 많고 정확할수록 위)
     *  loginId ~ carNum : 항목별 조건 (걸면 좁혀지고 서로 AND)
     *  includeWithdrawn : true 면 탈퇴 회원도 포함 (기본은 제외)
     */
    @GetMapping
    public ApiResponse<PageResponse<CustomerListItem>> list(
            @RequestParam(name = "keyword", required = false) String keyword,
            @RequestParam(name = "loginId", required = false) String loginId,
            @RequestParam(name = "name", required = false) String name,
            @RequestParam(name = "email", required = false) String email,
            @RequestParam(name = "phone", required = false) String phone,
            @RequestParam(name = "carNum", required = false) String carNum,
            @RequestParam(name = "includeWithdrawn", defaultValue = "false") boolean includeWithdrawn,
            @RequestParam(name = "page", defaultValue = "1") int page,
            @RequestParam(name = "size", defaultValue = "20") int size) {
        return ApiResponse.ok(customerSearchService.search(keyword, loginId, name, email, phone, carNum,
                includeWithdrawn, page, size));
    }

    // 고객 정보 수정 (고객 본인 마이페이지와 같은 항목). 없으면 404, 탈퇴 회원이면 409
    @PutMapping("/{id}")
    public ApiResponse<Void> update(@PathVariable("id") Long id,
                                     @Valid @RequestBody CustomerProfileUpdateRequest request) {
        customerSearchService.updateCustomer(id, request);
        return ApiResponse.ok("고객 정보가 수정되었습니다.", null);
    }

    // 강제 탈퇴 (차량·작성글·푸시 토큰도 함께 정리). 이미 탈퇴한 회원이면 409
    @PostMapping("/{id}/withdraw")
    public ApiResponse<Void> withdraw(@PathVariable("id") Long id) {
        customerSearchService.forceWithdraw(id);
        return ApiResponse.ok("탈퇴 처리되었습니다.", null);
    }
}