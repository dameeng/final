package com.mbc.puf.alert.controller;

import java.time.LocalDate;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.mbc.puf.alert.dto.AlertLogListItem;
import com.mbc.puf.alert.service.AlertService;
import com.mbc.puf.common.enums.AlertType;
import com.mbc.puf.common.response.ApiResponse;
import com.mbc.puf.common.response.PageResponse;

/** 알림 발송 이력 조회 (MP-15 초기 버전). 발송 로직 자체는 아직 없어서 "실제로 쌓이는지" 확인용 */
@RestController
@RequestMapping("/api/alert-logs")
@PreAuthorize("hasAnyRole('SUPER_ADMIN', 'REGIONAL_ADMIN')")
public class AlertLogController {

    private final AlertService alertService;

    public AlertLogController(AlertService alertService) {
        this.alertService = alertService;
    }

    /**
     * 알림 로그 목록. 전부 선택 필터.
     *  underpassId        : 그 지하차도에서 발생한 이벤트로 나간 알림만
     *  customerId         : 그 고객에게 나간 알림만
     *  alertType          : PREDICTIVE/ROI_FINAL 중 하나만
     *  startDate~endDate  : 발송일 기간(둘 다 선택, 둘 다 포함하는 날짜 범위)
     *  keyword            : 차량번호 포함검색(공백 무시)
     */
    @GetMapping
    public ApiResponse<PageResponse<AlertLogListItem>> list(
            @RequestParam(name = "underpassId", required = false) Long underpassId,
            @RequestParam(name = "customerId", required = false) Long customerId,
            @RequestParam(name = "alertType", required = false) AlertType alertType,
            @RequestParam(name = "startDate", required = false) LocalDate startDate,
            @RequestParam(name = "endDate", required = false) LocalDate endDate,
            @RequestParam(name = "keyword", required = false) String keyword,
            @RequestParam(name = "page", defaultValue = "1") int page,
            @RequestParam(name = "size", defaultValue = "20") int size) {
        return ApiResponse.ok(alertService.getAlertLogs(underpassId, customerId, alertType, startDate, endDate,
                keyword, page, size));
    }
}