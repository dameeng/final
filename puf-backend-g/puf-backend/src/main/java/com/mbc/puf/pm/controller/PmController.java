package com.mbc.puf.pm.controller;

import java.util.List;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.mbc.puf.common.response.ApiResponse;
import com.mbc.puf.common.security.LoginUser;
import com.mbc.puf.pm.dto.PmActionCreateRequest;
import com.mbc.puf.pm.dto.PmActionItem;
import com.mbc.puf.pm.dto.PmEquipmentDetailResponse;
import com.mbc.puf.pm.dto.PmEquipmentItem;
import com.mbc.puf.pm.dto.PmEventItem;
import com.mbc.puf.pm.dto.PmEventStatusRequest;
import com.mbc.puf.pm.dto.PmRuleItem;
import com.mbc.puf.pm.dto.PmThresholdItem;
import com.mbc.puf.pm.dto.PmThresholdUpdateRequest;
import com.mbc.puf.pm.dto.PmTrendResponse;
import com.mbc.puf.pm.entity.PmEquipmentType;
import com.mbc.puf.pm.entity.PmLevel;
import com.mbc.puf.pm.service.PmService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

/**
 * 예지보전 (MP-20): 설비(CCTV·전광판·배수펌프) 고장 위험 점수, 점검 대상, 조치 기록, 기준.
 * 화면: /pm-equipment, /pm-equipment-detail, /pm-queue, /pm-history, /pm-settings, 대시보드 '예지보전 Top5'
 */
@Tag(name = "예지보전")
@RestController
@RequestMapping("/api/pm")
@PreAuthorize("hasRole('REGIONAL_ADMIN')")
public class PmController {

    private final PmService pmService;

    public PmController(PmService pmService) {
        this.pmService = pmService;
    }

    @Operation(summary = "점수 규칙", description = "설비 종류별 측정 항목·기준값·가중치 (읽기 전용)")
    @GetMapping("/rules")
    public ApiResponse<List<PmRuleItem>> rules() {
        return ApiResponse.ok(pmService.getRules());
    }

    @Operation(summary = "설비 목록", description = "점수 높은 순. type=PUMP/CCTV/DISPLAY, level=SAFE/CAUTION/DANGER")
    @GetMapping("/equipments")
    public ApiResponse<List<PmEquipmentItem>> equipments(@AuthenticationPrincipal LoginUser loginUser,
            @RequestParam(name = "type", required = false) PmEquipmentType type,
            @RequestParam(name = "level", required = false) PmLevel level,
            @RequestParam(name = "regionId", required = false) Long regionId,
            @RequestParam(name = "underpassId", required = false) Long underpassId) {
        return ApiResponse.ok(pmService.getEquipments(loginUser, type, level, regionId, underpassId));
    }

    @Operation(summary = "예지보전 Top5", description = "대시보드 위젯용. 점수 높은 설비 limit 개")
    @GetMapping("/equipments/top")
    public ApiResponse<List<PmEquipmentItem>> top(@AuthenticationPrincipal LoginUser loginUser,
            @RequestParam(name = "limit", defaultValue = "5") int limit) {
        return ApiResponse.ok(pmService.getTop(loginUser, limit));
    }

    @Operation(summary = "설비 상세", description = "최신 점수, 항목별 점수 근거, 사유, 기준, 권장 조치, 차단 사유")
    @GetMapping("/equipments/{equipId}")
    public ApiResponse<PmEquipmentDetailResponse> detail(@AuthenticationPrincipal LoginUser loginUser,
            @PathVariable("equipId") Long equipId) {
        return ApiResponse.ok(pmService.getDetail(loginUser, equipId));
    }

    @Operation(summary = "설비 추이 그래프", description = "최근 days 일 점수·측정값")
    @GetMapping("/equipments/{equipId}/trend")
    public ApiResponse<PmTrendResponse> trend(@AuthenticationPrincipal LoginUser loginUser,
            @PathVariable("equipId") Long equipId,
            @RequestParam(name = "days", defaultValue = "7") int days) {
        return ApiResponse.ok(pmService.getTrend(loginUser, equipId, days));
    }

    @GetMapping("/equipments/{equipId}/thresholds")
    public ApiResponse<List<PmThresholdItem>> thresholds(@AuthenticationPrincipal LoginUser loginUser,
            @PathVariable("equipId") Long equipId) {
        return ApiResponse.ok(pmService.getThresholds(loginUser, equipId));
    }

    @Operation(summary = "기준 수정", description = "level=CAUTION/DANGER (SAFE 는 0 고정). 담당 지역 설비만")
    @PutMapping("/equipments/{equipId}/thresholds/{level}")
    public ApiResponse<PmThresholdItem> updateThreshold(@AuthenticationPrincipal LoginUser loginUser,
            @PathVariable("equipId") Long equipId, @PathVariable("level") PmLevel level,
            @Valid @RequestBody PmThresholdUpdateRequest request) {
        return ApiResponse.ok("기준이 수정되었습니다.",
                pmService.updateThreshold(loginUser, equipId, level, request.minScore()));
    }

    @Operation(summary = "점검 대상 목록", description = "openOnly=true 면 확인필요·점검중만 (점검 대기 화면)")
    @GetMapping("/events")
    public ApiResponse<List<PmEventItem>> events(@AuthenticationPrincipal LoginUser loginUser,
            @RequestParam(name = "openOnly", defaultValue = "true") boolean openOnly,
            @RequestParam(name = "type", required = false) PmEquipmentType type) {
        return ApiResponse.ok(pmService.getEvents(loginUser, openOnly, type));
    }

    // 팀 CORS 설정(WebConfigurer)이 PATCH 를 허용하지 않아서 화면은 PUT 으로 부름 (PATCH 도 받음)
    @Operation(summary = "점검 상태 바꾸기", description = "CHECK_NEEDED → IN_PROGRESS → RESOLVED/ETC (앞으로만)")
    @RequestMapping(value = "/events/{eventId}/status", method = {RequestMethod.PUT, RequestMethod.PATCH})
    public ApiResponse<PmEventItem> changeStatus(@AuthenticationPrincipal LoginUser loginUser,
            @PathVariable("eventId") Long eventId, @Valid @RequestBody PmEventStatusRequest request) {
        return ApiResponse.ok("상태가 변경되었습니다.", pmService.changeStatus(loginUser, eventId, request.status()));
    }

    @Operation(summary = "조치 등록", description = "status 를 같이 보내면 상태도 함께 바뀜 (예: RESOLVED)")
    @PostMapping("/events/{eventId}/actions")
    public ApiResponse<PmActionItem> addAction(@AuthenticationPrincipal LoginUser loginUser,
            @PathVariable("eventId") Long eventId, @Valid @RequestBody PmActionCreateRequest request) {
        return ApiResponse.ok("조치가 등록되었습니다.", pmService.addAction(loginUser, eventId, request));
    }

    @Operation(summary = "점검 이력", description = "조치 기록 최신순 200건")
    @GetMapping("/actions")
    public ApiResponse<List<PmActionItem>> actions(@AuthenticationPrincipal LoginUser loginUser,
            @RequestParam(name = "type", required = false) PmEquipmentType type,
            @RequestParam(name = "equipId", required = false) Long equipId) {
        return ApiResponse.ok(pmService.getActions(loginUser, type, equipId));
    }
}
