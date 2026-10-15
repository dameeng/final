package com.mbc.puf.underpass.controller;

import java.time.LocalDate;
import java.util.List;

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

import com.mbc.puf.common.enums.TransitStatus;
import com.mbc.puf.common.response.ApiResponse;
import com.mbc.puf.common.response.PageResponse;
import com.mbc.puf.common.security.LoginUser;
import com.mbc.puf.underpass.dto.CameraAssignRequest;
import com.mbc.puf.underpass.dto.ControlHistoryItem;
import com.mbc.puf.underpass.dto.DisplayLogRequest;
import com.mbc.puf.underpass.dto.TransitHistoryItem;
import com.mbc.puf.underpass.dto.TransitResponse;
import com.mbc.puf.underpass.dto.UnderpassCreateRequest;
import com.mbc.puf.underpass.dto.UnderpassDetailResponse;
import com.mbc.puf.underpass.dto.UnderpassListItem;
import com.mbc.puf.underpass.dto.UnderpassUpdateRequest;
import com.mbc.puf.underpass.service.UnderpassService;
import com.mbc.puf.internal.dto.RiskScoreTrendItem;

import jakarta.validation.Valid;

/** 지하차도 등록·관리 및 차단/해제(MP-10). 목록·상세 조회(CP-05~07)는 로그인 없이 공개,
 *  나머지는 관리자 전용(메서드별 @PreAuthorize) */
@RestController
@RequestMapping("/api/underpasses")
public class UnderpassController {

    private final UnderpassService underpassService;

    public UnderpassController(UnderpassService underpassService) {
        this.underpassService = underpassService;
    }

    /**
     * 지하차도 목록. 로그인 없이 공개(CP-05~07), 관리자도 동일 API 사용.
     *  regionId : 선택 필터, 안 주면 전체 지역 대상
     *  keyword  : 이름 검색 (없으면 전체)
     */
    @GetMapping
    public ApiResponse<PageResponse<UnderpassListItem>> list(
            @AuthenticationPrincipal LoginUser loginUser,
            @RequestParam(name = "regionId", required = false) Long regionId,
            @RequestParam(name = "keyword", required = false) String keyword,
            @RequestParam(name = "page", defaultValue = "1") int page,
            @RequestParam(name = "size", defaultValue = "20") int size) {
        return ApiResponse.ok(underpassService.getUnderpassList(loginUser, regionId, keyword, page, size));
    }

    // 지하차도 상세. 로그인 없이 공개(CP-05~07)
    @GetMapping("/{id}")
    public ApiResponse<UnderpassDetailResponse> detail(@AuthenticationPrincipal LoginUser loginUser,
                                                        @PathVariable("id") Long id) {
        return ApiResponse.ok(underpassService.getUnderpass(loginUser, id));
    }

    // 위험도 추이 (MP-05). 로그인 없이 공개.
    //  limit : 안 주면 기본 개수(hours 없으면 24개, hours 있으면 넉넉한 안전 상한)
    //  hours : 주면 "최근 N시간" 범위로 거른다(스케줄러가 분 단위로 쌓는 구조라, 시간 단위 화면에선
    //          limit만으로는 "최근 N개 ≒ 최근 N분"이 돼버리므로 시간 범위를 직접 지정하고 싶을 때 사용)
    @GetMapping("/{id}/risk-scores")
    public ApiResponse<List<RiskScoreTrendItem>> riskScoreTrend(
            @PathVariable("id") Long id,
            @RequestParam(name = "limit", required = false) Integer limit,
            @RequestParam(name = "hours", required = false) Integer hours) {
        return ApiResponse.ok(underpassService.getRiskScoreTrend(id, limit, hours));
    }

    // 지하차도 등록 (201 Created). REGIONAL_ADMIN은 본인 담당 지역만 선택 가능
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'REGIONAL_ADMIN')")
    @PostMapping
    public ResponseEntity<ApiResponse<UnderpassDetailResponse>> create(
            @AuthenticationPrincipal LoginUser loginUser,
            @Valid @RequestBody UnderpassCreateRequest request) {
        UnderpassDetailResponse created = underpassService.createUnderpass(loginUser, request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("지하차도가 등록되었습니다.", created));
    }

    // 지하차도 정보 수정 (current_status 제외). REGIONAL_ADMIN은 본인 담당 지역 것만 가능
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'REGIONAL_ADMIN')")
    @PutMapping("/{id}")
    public ApiResponse<UnderpassDetailResponse> update(
            @AuthenticationPrincipal LoginUser loginUser,
            @PathVariable("id") Long id,
            @Valid @RequestBody UnderpassUpdateRequest request) {
        return ApiResponse.ok("지하차도 정보가 수정되었습니다.", underpassService.updateUnderpass(loginUser, id, request));
    }

    // 지하차도 삭제 (소프트 삭제). REGIONAL_ADMIN은 본인 담당 지역 것만 가능
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'REGIONAL_ADMIN')")
    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@AuthenticationPrincipal LoginUser loginUser, @PathVariable("id") Long id) {
        underpassService.deleteUnderpass(loginUser, id);
        return ApiResponse.ok("지하차도가 삭제되었습니다.", null);
    }

    // 차단 (MP-10). 이미 BLOCKED면 409. REGIONAL_ADMIN은 본인 담당 지역만 가능
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'REGIONAL_ADMIN')")
    @PostMapping("/{id}/block")
    public ApiResponse<UnderpassDetailResponse> block(@AuthenticationPrincipal LoginUser loginUser,
                                                        @PathVariable("id") Long id) {
        return ApiResponse.ok("지하차도가 차단되었습니다.", underpassService.blockUnderpass(loginUser, id));
    }

    // 해제 (MP-10). 이미 NORMAL이면 409. REGIONAL_ADMIN은 본인 담당 지역만 가능
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'REGIONAL_ADMIN')")
    @PostMapping("/{id}/release")
    public ApiResponse<UnderpassDetailResponse> release(@AuthenticationPrincipal LoginUser loginUser,
                                                          @PathVariable("id") Long id) {
        return ApiResponse.ok("지하차도가 해제되었습니다.", underpassService.releaseUnderpass(loginUser, id));
    }

    // 입구 카메라 지정. 지정하려는 카메라가 이 지하차도 소속이 아니면 400
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'REGIONAL_ADMIN')")
    @PutMapping("/{id}/entry-camera")
    public ApiResponse<UnderpassDetailResponse> assignEntryCamera(
            @AuthenticationPrincipal LoginUser loginUser,
            @PathVariable("id") Long id,
            @Valid @RequestBody CameraAssignRequest request) {
        return ApiResponse.ok("입구 카메라가 지정되었습니다.", underpassService.assignEntryCamera(loginUser, id, request));
    }

    // 출구 카메라 지정. 지정하려는 카메라가 이 지하차도 소속이 아니면 400
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'REGIONAL_ADMIN')")
    @PutMapping("/{id}/exit-camera")
    public ApiResponse<UnderpassDetailResponse> assignExitCamera(
            @AuthenticationPrincipal LoginUser loginUser,
            @PathVariable("id") Long id,
            @Valid @RequestBody CameraAssignRequest request) {
        return ApiResponse.ok("출구 카메라가 지정되었습니다.", underpassService.assignExitCamera(loginUser, id, request));
    }

    /**
     * 통과 기록(잔류차량 등) 목록.
     *  status : REMAINING/IN_TRANSIT/EXITED 중 하나로 필터(선택), 안 넣으면 전체
     */
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'REGIONAL_ADMIN')")
    @GetMapping("/{id}/transits")
    public ApiResponse<List<TransitResponse>> transits(
            @AuthenticationPrincipal LoginUser loginUser,
            @PathVariable("id") Long id,
            @RequestParam(name = "status", required = false) TransitStatus status) {
        return ApiResponse.ok(underpassService.getTransits(loginUser, id, status));
    }

    /**
     * 통과 이력 조회(검색·기간·페이징). 위 /{id}/transits(잔류차량 목록용, List 응답)와 별개. 전부 선택 필터.
     * 시설을 안 고르면 SUPER_ADMIN은 전체, REGIONAL_ADMIN은 본인 담당 지역 전체.
     *  underpassId       : 그 지하차도 기록만
     *  status            : REMAINING/IN_TRANSIT/EXITED 중 하나만
     *  keyword           : 차량번호 포함검색(공백 무시)
     *  startDate~endDate : 진입일 기간(둘 다 선택, 둘 다 포함하는 날짜 범위)
     */
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'REGIONAL_ADMIN')")
    @GetMapping("/transits")
    public ApiResponse<PageResponse<TransitHistoryItem>> transitHistory(
            @AuthenticationPrincipal LoginUser loginUser,
            @RequestParam(name = "underpassId", required = false) Long underpassId,
            @RequestParam(name = "status", required = false) TransitStatus status,
            @RequestParam(name = "keyword", required = false) String keyword,
            @RequestParam(name = "startDate", required = false) LocalDate startDate,
            @RequestParam(name = "endDate", required = false) LocalDate endDate,
            @RequestParam(name = "page", defaultValue = "1") int page,
            @RequestParam(name = "size", defaultValue = "20") int size) {
        return ApiResponse.ok(underpassService.getTransitHistory(loginUser, underpassId, status, keyword,
                startDate, endDate, page, size));
    }

    /**
     * 제어이력(MP-16: 차단/해제/위험도상승 + 전광판 조작 통합, 시간순).
     *  kind              : "EVENT"(차단/해제/위험도 변화만) / "DISPLAY"(전광판 조작만), 안 주면 전체
     *  startDate~endDate : 조회 기간(둘 다 선택, 둘 다 포함하는 날짜 범위)
     */
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'REGIONAL_ADMIN')")
    @GetMapping("/{id}/events")
    public ApiResponse<List<ControlHistoryItem>> events(
            @AuthenticationPrincipal LoginUser loginUser,
            @PathVariable("id") Long id,
            @RequestParam(name = "kind", required = false) String kind,
            @RequestParam(name = "startDate", required = false) LocalDate startDate,
            @RequestParam(name = "endDate", required = false) LocalDate endDate) {
        return ApiResponse.ok(underpassService.getControlHistory(loginUser, id, kind, startDate, endDate));
    }

    // 전광판 조작 (기록만 남김, 실제 장치 제어 없음). REGIONAL_ADMIN은 본인 담당 지역만 가능
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'REGIONAL_ADMIN')")
    @PostMapping("/{id}/display-log")
    public ApiResponse<Void> postDisplayLog(@AuthenticationPrincipal LoginUser loginUser,
                                             @PathVariable("id") Long id,
                                             @Valid @RequestBody DisplayLogRequest request) {
        underpassService.postDisplayLog(loginUser, id, request);
        return ApiResponse.ok("전광판 조작이 기록되었습니다.", null);
    }
}