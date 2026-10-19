package com.mbc.puf.display.controller;

import com.mbc.puf.common.enums.DisplayCategory;
import com.mbc.puf.common.response.ApiResponse;
import com.mbc.puf.common.security.LoginUser;
import com.mbc.puf.display.dto.DisplayPageItem;
import com.mbc.puf.display.dto.DisplayPageSaveRequest;
import com.mbc.puf.display.dto.DisplayPresetItem;
import com.mbc.puf.display.service.DisplayService;
import jakarta.validation.Valid;
import java.util.List;
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

/**
 * 전광판 문구 관리 API
 *  - 프리셋 조회
 *  - 페이지 CRUD (내용 변경 시에만 히스토리 기록)
 */
@RestController
@RequestMapping("/api/display")
public class DisplayController {

    private final DisplayService displayService;

    public DisplayController(DisplayService displayService) {
        this.displayService = displayService;
    }

    // ── 프리셋 ─────────────────────────────────────────────────────

    /**
     * GET /api/display/presets?category=SAFE
     * 전광판 문구 프리셋 목록. category 파라미터를 생략하면 전체.
     */
    @GetMapping("/presets")
    @PreAuthorize("isAuthenticated() and principal.manager")
    public ResponseEntity<ApiResponse<List<DisplayPresetItem>>> getPresets(
            @RequestParam(required = false) DisplayCategory category) {
        return ResponseEntity.ok(ApiResponse.ok("전광판 프리셋 목록입니다.", displayService.getPresets(category)));
    }

    // ── 페이지 목록 ────────────────────────────────────────────────

    /**
     * GET /api/display/equipments/{equipId}/pages
     * 특정 전광판 설비의 페이지 목록 (page_no 오름차순).
     */
    @GetMapping("/equipments/{equipId}/pages")
    @PreAuthorize("isAuthenticated() and principal.manager")
    public ResponseEntity<ApiResponse<List<DisplayPageItem>>> getPages(@PathVariable Long equipId) {
        return ResponseEntity.ok(ApiResponse.ok("전광판 페이지 목록입니다.", displayService.getPages(equipId)));
    }

    // ── 페이지 생성 ────────────────────────────────────────────────

    /**
     * POST /api/display/equipments/{equipId}/pages
     * 페이지 신규 추가 (page_no 자동 부여, 히스토리 기록).
     */
    @PostMapping("/equipments/{equipId}/pages")
    @PreAuthorize("isAuthenticated() and principal.manager")
    public ResponseEntity<ApiResponse<DisplayPageItem>> createPage(
            @AuthenticationPrincipal LoginUser loginUser,
            @PathVariable Long equipId,
            @Valid @RequestBody DisplayPageSaveRequest request) {
        DisplayPageItem item = displayService.createPage(loginUser, equipId, request);
        return ResponseEntity.ok(ApiResponse.ok("전광판 페이지가 추가되었습니다.", item));
    }

    // ── 페이지 수정 ────────────────────────────────────────────────

    /**
     * PUT /api/display/equipments/{equipId}/pages/{pageNo}
     * 페이지 문구 수정 (내용 변경 시에만 히스토리 기록).
     */
    @PutMapping("/equipments/{equipId}/pages/{pageNo}")
    @PreAuthorize("isAuthenticated() and principal.manager")
    public ResponseEntity<ApiResponse<DisplayPageItem>> updatePage(
            @AuthenticationPrincipal LoginUser loginUser,
            @PathVariable Long equipId,
            @PathVariable Integer pageNo,
            @Valid @RequestBody DisplayPageSaveRequest request) {
        DisplayPageItem item = displayService.updatePage(loginUser, equipId, pageNo, request);
        return ResponseEntity.ok(ApiResponse.ok("전광판 페이지가 수정되었습니다.", item));
    }

    // ── 페이지 삭제 ────────────────────────────────────────────────

    /**
     * DELETE /api/display/equipments/{equipId}/pages/{pageNo}
     * 페이지 삭제 후 뒤 페이지들 page_no 재정렬.
     */
    @DeleteMapping("/equipments/{equipId}/pages/{pageNo}")
    @PreAuthorize("isAuthenticated() and principal.manager")
    public ResponseEntity<ApiResponse<Void>> deletePage(
            @AuthenticationPrincipal LoginUser loginUser,
            @PathVariable Long equipId,
            @PathVariable Integer pageNo) {
        displayService.deletePage(loginUser, equipId, pageNo);
        return ResponseEntity.ok(ApiResponse.ok("전광판 페이지가 삭제되었습니다.", null));
    }
}
