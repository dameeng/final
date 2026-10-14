package com.mbc.puf.member.controller;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.mbc.puf.common.enums.ManagerRole;
import com.mbc.puf.common.enums.ManagerStatus;
import com.mbc.puf.common.response.ApiResponse;
import com.mbc.puf.common.response.PageResponse;
import com.mbc.puf.common.security.LoginUser;
import com.mbc.puf.member.dto.ManagerRegionRequest;
import com.mbc.puf.member.dto.ManagerSummaryResponse;
import com.mbc.puf.member.service.ManagerAdminService;

import jakarta.validation.Valid;

/** 관리자 계정 관리: 이 컨트롤러의 모든 API는 최고관리자만 사용할 수 있다 */
@RestController
@RequestMapping("/api/managers")
@PreAuthorize("hasRole('SUPER_ADMIN')")
public class ManagerAdminController {

    private final ManagerAdminService managerAdminService;

    public ManagerAdminController(ManagerAdminService managerAdminService) {
        this.managerAdminService = managerAdminService;
    }

    /**
     * 관리자 목록.
     *  keyword          : 아이디·이름·이메일·전화번호 통합 검색 (일치 점수 순)
     *  status           : 지정하면 그 상태만 (WITHDRAWN 이면 탈퇴·거절 계정만)
     *  includeWithdrawn : status 를 지정하지 않았을 때 true 면 탈퇴·거절 계정도 포함 (기본은 제외)
     */
    @GetMapping
    public ApiResponse<PageResponse<ManagerSummaryResponse>> list(
            @RequestParam(name = "keyword", required = false) String keyword,
            @RequestParam(name = "status", required = false) ManagerStatus status,
            @RequestParam(name = "role", required = false) ManagerRole role,
            @RequestParam(name = "regionId", required = false) Long regionId,
            @RequestParam(name = "includeWithdrawn", defaultValue = "false") boolean includeWithdrawn,
            @RequestParam(name = "page", defaultValue = "1") int page,
            @RequestParam(name = "size", defaultValue = "20") int size) {
        return ApiResponse.ok(managerAdminService.getManagerList(keyword, status, role, regionId,
                includeWithdrawn, page, size));
    }

    // 승인대기 목록 (오래된 신청부터)
    @GetMapping("/pending")
    public ApiResponse<PageResponse<ManagerSummaryResponse>> pending(
            @RequestParam(name = "page", defaultValue = "1") int page,
            @RequestParam(name = "size", defaultValue = "20") int size) {
        return ApiResponse.ok(managerAdminService.getPendingList(page, size));
    }

    // 가입 승인 (담당 지역을 함께 지정한다. '미배정'도 선택 가능)
    @PostMapping("/{id}/approve")
    public ApiResponse<ManagerSummaryResponse> approve(@PathVariable("id") Long id,
                                                       @Valid @RequestBody ManagerRegionRequest request,
                                                       @AuthenticationPrincipal LoginUser loginUser) {
        return ApiResponse.ok("가입을 승인했습니다.",
                managerAdminService.approve(id, request.getRegionId(), loginUser.id()));
    }

    // 가입 거절 (승인대기 계정만)
    @PostMapping("/{id}/reject")
    public ApiResponse<ManagerSummaryResponse> reject(@PathVariable("id") Long id) {
        return ApiResponse.ok("가입 신청을 거절했습니다.", managerAdminService.reject(id));
    }

    // 강제 탈퇴 (활성 계정만, 최고관리자 계정 제외)
    @PostMapping("/{id}/withdraw")
    public ApiResponse<ManagerSummaryResponse> withdraw(@PathVariable("id") Long id) {
        return ApiResponse.ok("탈퇴 처리했습니다.", managerAdminService.withdraw(id));
    }

    // 담당 지역 재배정 (활성 지역담당자만)
    @PutMapping("/{id}/region")
    public ApiResponse<ManagerSummaryResponse> reassignRegion(@PathVariable("id") Long id,
                                                              @Valid @RequestBody ManagerRegionRequest request) {
        return ApiResponse.ok("담당 지역을 변경했습니다.",
                managerAdminService.reassignRegion(id, request.getRegionId()));
    }
}
