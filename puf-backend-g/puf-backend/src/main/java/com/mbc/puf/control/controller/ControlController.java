package com.mbc.puf.control.controller;

import com.mbc.puf.common.enums.ReasonType;
import com.mbc.puf.common.response.ApiResponse;
import com.mbc.puf.common.security.LoginUser;
import com.mbc.puf.control.dto.BlockRequest;
import com.mbc.puf.control.dto.CtrlTransferItem;
import com.mbc.puf.control.dto.FireTransferRequest;
import com.mbc.puf.control.dto.ReasonPresetItem;
import com.mbc.puf.control.service.ControlService;
import com.mbc.puf.control.service.ControlService.PdfResult;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
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

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

/**
 * 통제 관련 API (MP-10 확장)
 *  - 차단/해제 with 사유 + 경찰 이관 PDF 자동 생성
 *  - 소방 이관 (수동: 잔류차량 목록 제출)
 *  - 이관 기록 목록 조회
 *  - 이관 기록 단건 PDF 재출력
 */
@Tag(name = "통제(차단·해제·이관)", description = "차단/해제 사유 프리셋, 차단·해제, 경찰·소방 이관 문서. 모두 관리자 전용이며 담당 지역만 가능")
@RestController
@RequestMapping("/api/control")
public class ControlController {

    private final ControlService controlService;

    public ControlController(ControlService controlService) {
        this.controlService = controlService;
    }

    // ── 사유 프리셋 ──────────────────────────────────────────────────

    /**
     * GET /api/control/reason-presets
     * 차단/해제 사유 프리셋 목록 (로그인한 관리자 모두 조회 가능)
     *  type : BLOCK(차단 사유) / RELEASE(해제 사유), 안 보내면 전체
     */
    @Operation(summary = "차단/해제 사유 프리셋", description = "type=BLOCK 이면 차단 사유, type=RELEASE 이면 해제 사유만 내려간다")
    @GetMapping("/reason-presets")
    @PreAuthorize("isAuthenticated() and principal.manager")
    public ResponseEntity<ApiResponse<List<ReasonPresetItem>>> getReasonPresets(
            @RequestParam(name = "type", required = false) ReasonType type) {
        return ResponseEntity.ok(ApiResponse.ok("사유 프리셋 목록입니다.", controlService.getReasonPresets(type)));
    }

    // ── 차단 (사유 포함 + 경찰 이관 PDF) ────────────────────────────

    /**
     * POST /api/control/underpasses/{id}/block
     * 지하차도 차단 + 경찰 이관 PDF 반환.
     * 요청 body: { presetId, reason } — 둘 다 없으면 사유 null (PDF에 '-' 로 표시).
     */
    @PostMapping("/underpasses/{id}/block")
    @PreAuthorize("isAuthenticated() and principal.manager")
    public ResponseEntity<byte[]> block(
            @AuthenticationPrincipal LoginUser loginUser,
            @PathVariable("id") Long id,
            @Valid @RequestBody(required = false) BlockRequest request) {

        PdfResult result = controlService.blockUnderpass(loginUser, id, request);
        return pdfResponse(result);
    }

    // ── 해제 (사유 포함 + 경찰 이관 PDF) ────────────────────────────

    /**
     * POST /api/control/underpasses/{id}/release
     * 지하차도 해제 + 경찰 이관 PDF 반환.
     */
    @PostMapping("/underpasses/{id}/release")
    @PreAuthorize("isAuthenticated() and principal.manager")
    public ResponseEntity<byte[]> release(
            @AuthenticationPrincipal LoginUser loginUser,
            @PathVariable("id") Long id,
            @Valid @RequestBody(required = false) BlockRequest request) {

        PdfResult result = controlService.releaseUnderpass(loginUser, id, request);
        return pdfResponse(result);
    }

    // ── 소방 이관 (수동) ─────────────────────────────────────────────

    /**
     * POST /api/control/underpasses/{id}/fire-transfer
     * 소방 이관 (잔류차량 목록 제출) + PDF 반환.
     * 관리자가 잔류차량 확인 후 직접 버튼을 눌러 제출하는 수동 방식.
     */
    @PostMapping("/underpasses/{id}/fire-transfer")
    @PreAuthorize("isAuthenticated() and principal.manager")
    public ResponseEntity<byte[]> fireTransfer(
            @AuthenticationPrincipal LoginUser loginUser,
            @PathVariable("id") Long id,
            @Valid @RequestBody FireTransferRequest request) {

        PdfResult result = controlService.fireTransfer(loginUser, id, request);
        return pdfResponse(result);
    }

    // ── 이관 기록 목록 ───────────────────────────────────────────────

    /**
     * GET /api/control/underpasses/{id}/transfers
     * 특정 지하차도의 이관 기록 목록 (최신순).
     */
    @GetMapping("/underpasses/{id}/transfers")
    @PreAuthorize("isAuthenticated() and principal.manager")
    public ResponseEntity<ApiResponse<List<CtrlTransferItem>>> getTransferHistory(
            @AuthenticationPrincipal LoginUser loginUser,
            @PathVariable("id") Long id) {

        return ResponseEntity.ok(ApiResponse.ok("이관 기록 목록입니다.", controlService.getTransferHistory(loginUser, id)));
    }

    // ── 이관 기록 PDF 재출력 ─────────────────────────────────────────

    /**
     * GET /api/control/transfers/{transferId}/pdf
     * 저장된 이관 기록으로 동일 PDF 재생성 (재출력).
     */
    @GetMapping("/transfers/{transferId}/pdf")
    @PreAuthorize("isAuthenticated() and principal.manager")
    public ResponseEntity<byte[]> redownloadPdf(@AuthenticationPrincipal LoginUser loginUser,
                                                @PathVariable("transferId") Long transferId) {
        PdfResult result = controlService.redownloadPdf(loginUser, transferId);
        return pdfResponse(result);
    }

    // ── 공통 PDF 응답 빌더 ──────────────────────────────────────────

    private ResponseEntity<byte[]> pdfResponse(PdfResult result) {
        String encodedName = URLEncoder.encode(result.filename(), StandardCharsets.UTF_8)
                .replace("+", "%20");

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_PDF);
        // RFC 5987 방식으로 한글 파일명 지원
        headers.set(HttpHeaders.CONTENT_DISPOSITION,
                "attachment; filename*=UTF-8''" + encodedName);
        headers.setContentLength(result.bytes().length);

        return ResponseEntity.ok()
                .headers(headers)
                .body(result.bytes());
    }
}