package com.mbc.puf.underpass.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.mbc.puf.common.enums.TransitStatus;
import com.mbc.puf.common.enums.UnderpassCurrentStatus;
import com.mbc.puf.common.request.PageQuery;
import com.mbc.puf.common.request.PeriodQuery;
import com.mbc.puf.common.request.ScopeQuery;
import com.mbc.puf.common.request.VehicleQuery;
import com.mbc.puf.common.response.ApiResponse;
import com.mbc.puf.common.response.PageResponse;
import com.mbc.puf.common.security.LoginUser;
import com.mbc.puf.underpass.dto.GateCameraRequest;
import com.mbc.puf.underpass.dto.ControlHistoryItem;
import com.mbc.puf.underpass.dto.TransitHistoryItem;
import com.mbc.puf.underpass.dto.UnderpassCreateRequest;
import com.mbc.puf.underpass.dto.UnderpassDetailResponse;
import com.mbc.puf.underpass.dto.UnderpassListItem;
import com.mbc.puf.underpass.dto.UnderpassUpdateRequest;
import com.mbc.puf.underpass.service.UnderpassService;
import com.mbc.puf.internal.dto.RiskScoreTrendItem;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

/** 지하차도 등록·관리 및 차단/해제(MP-10). 목록·상세 조회(CP-05~07)는 로그인 없이 공개,
 *  나머지는 관리자 전용(메서드별 @PreAuthorize) */
@Tag(name = "지하차도", description = "목록·상세는 공개, 등록·수정·삭제는 담당 지역 관리자(차단·해제는 '통제' 태그의 /api/control)")
@RestController
@RequestMapping("/api/underpasses")
public class UnderpassController {

    private final UnderpassService underpassService;

    public UnderpassController(UnderpassService underpassService) {
        this.underpassService = underpassService;
    }

    /**
     * 지하차도 목록. 로그인 없이 공개(CP-05~07), 관리자도 동일 API 사용.
     *  scope    : ALL(전체, 기본) / MINE(내 담당 지역만, 관리자 전용). 지도 마커는 ALL, 관리자 시설 목록은 MINE
     *  regionId : 선택 필터, 안 주면 전체 지역 대상 (scope=MINE 이면 내 담당 지역 중에서만)
     *  keyword  : 이름 검색 (없으면 전체)
     *  status   : NORMAL/BLOCKED 선택 필터
     *  sort     : NAME(가나다순, 기본) / RISK_SCORE(최신 위험점수 높은 순) / LATEST(최근 등록순)
     *  page, size : 공통 Page 조건. 지도에 한 번에 뿌리는 용도가 있어서 이 목록만 size 최대 500
     */
    @Operation(summary = "지하차도 목록", description = "scope=MINE 이면 로그인한 관리자의 담당 지역만. 각 항목의 manageable 이 false 면 내 시설이 아니므로 차단·수정 버튼을 막아주세요")
    @GetMapping
    public ApiResponse<PageResponse<UnderpassListItem>> list(
            @AuthenticationPrincipal LoginUser loginUser,
            @RequestParam(name = "scope", defaultValue = "ALL") UnderpassService.ListScope scope,
            @RequestParam(name = "regionId", required = false) Long regionId,
            @RequestParam(name = "keyword", required = false) String keyword,
            @RequestParam(name = "status", required = false) UnderpassCurrentStatus status,
            @RequestParam(name = "sort", defaultValue = "NAME") UnderpassService.Sort sort,
            @ModelAttribute PageQuery page) {
        return ApiResponse.ok(underpassService.getUnderpassList(loginUser, scope, regionId, keyword, status, sort, page));
    }

    // 지하차도 상세. 로그인 없이 공개(CP-05~07)
    @Operation(summary = "지하차도 상세", description = "manageable 로 내가 관리할 수 있는 시설인지 알 수 있다")
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
    @PreAuthorize("hasRole('REGIONAL_ADMIN')")
    @PostMapping
    public ResponseEntity<ApiResponse<UnderpassDetailResponse>> create(
            @AuthenticationPrincipal LoginUser loginUser,
            @Valid @RequestBody UnderpassCreateRequest request) {
        UnderpassDetailResponse created = underpassService.createUnderpass(loginUser, request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("지하차도가 등록되었습니다.", created));
    }

    // 지하차도 정보 수정 (current_status 제외). REGIONAL_ADMIN은 본인 담당 지역 것만 가능
    @PreAuthorize("hasRole('REGIONAL_ADMIN')")
    @PutMapping("/{id}")
    public ApiResponse<UnderpassDetailResponse> update(
            @AuthenticationPrincipal LoginUser loginUser,
            @PathVariable("id") Long id,
            @Valid @RequestBody UnderpassUpdateRequest request) {
        return ApiResponse.ok("지하차도 정보가 수정되었습니다.", underpassService.updateUnderpass(loginUser, id, request));
    }

    // 지하차도 삭제 (소프트 삭제). REGIONAL_ADMIN은 본인 담당 지역 것만 가능
    @PreAuthorize("hasRole('REGIONAL_ADMIN')")
    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@AuthenticationPrincipal LoginUser loginUser, @PathVariable("id") Long id) {
        underpassService.deleteUnderpass(loginUser, id);
        return ApiResponse.ok("지하차도가 삭제되었습니다.", null);
    }

    // 상행/하행 입·출구 카메라 지정 (MP-10-1). 네 자리를 한 번에 보내고 null 이면 지정 해제.
    // 이 지하차도 소속 카메라가 아니거나 한 카메라를 두 자리에 겹쳐 지정하면 400
    @PreAuthorize("hasRole('REGIONAL_ADMIN')")
    @PutMapping("/{id}/gate-cameras")
    public ApiResponse<UnderpassDetailResponse> assignGateCameras(
            @AuthenticationPrincipal LoginUser loginUser,
            @PathVariable("id") Long id,
            @RequestBody GateCameraRequest request) {
        return ApiResponse.ok("입출구 카메라가 지정되었습니다.", underpassService.assignGateCameras(loginUser, id, request));
    }

    /**
     * 통과 기록 목록 (잔류차량 목록과 통과 이력 검색을 하나로 합침. 예전 GET /{id}/transits 는 이걸로 흡수).
     *  잔류차량 목록 = ?underpassId=17&status=REMAINING
     *  underpassId, regionId : 공통 Scope 조건. REGIONAL_ADMIN은 본인 담당 지역으로 고정(밖의 시설을 지정하면 403)
     *  status                : REMAINING/IN_TRANSIT/EXITED 중 하나만
     *  carNum                : 공통 Vehicle 조건 (공백 무시 포함검색. 예전 keyword)
     *  startDate~endDate     : 공통 Period 조건 (진입일 기준, endDate 당일 포함)
     *  page, size            : 공통 Page 조건
     */
    @PreAuthorize("hasRole('REGIONAL_ADMIN')")
    @GetMapping("/transits")
    public ApiResponse<PageResponse<TransitHistoryItem>> transits(
            @AuthenticationPrincipal LoginUser loginUser,
            @ModelAttribute ScopeQuery scope,
            @RequestParam(name = "status", required = false) TransitStatus status,
            @ModelAttribute VehicleQuery vehicle,
            @ModelAttribute PeriodQuery period,
            @ModelAttribute PageQuery page) {
        period.validate();
        return ApiResponse.ok(underpassService.getTransitHistory(loginUser, scope, status, vehicle, period, page));
    }

    /**
     * 제어이력(MP-16: 차단/해제/위험도 변화 + 전광판 조작 통합, 최신순).
     *  kind              : "EVENT"(차단/해제/위험도 변화만) / "DISPLAY"(전광판 조작만), 안 주면 전체
     *  startDate~endDate : 공통 Period 조건 (endDate 당일 포함)
     *  page, size        : 공통 Page 조건 (예전엔 List 전체 반환)
     */
    @PreAuthorize("hasRole('REGIONAL_ADMIN')")
    @GetMapping("/{id}/events")
    public ApiResponse<PageResponse<ControlHistoryItem>> events(
            @AuthenticationPrincipal LoginUser loginUser,
            @PathVariable("id") Long id,
            @RequestParam(name = "kind", required = false) String kind,
            @ModelAttribute PeriodQuery period,
            @ModelAttribute PageQuery page) {
        period.validate();
        return ApiResponse.ok(underpassService.getControlHistory(loginUser, id, kind, period, page));
    }

}