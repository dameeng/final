package com.mbc.puf.cctv.controller;

import java.io.IOException;
import java.io.InputStream;
import java.net.http.HttpResponse;

import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.mbc.puf.cctv.dto.CctvAssignResponse;
import com.mbc.puf.cctv.service.CctvAssignService;
import com.mbc.puf.cctv.service.CctvService;
import com.mbc.puf.common.response.ApiResponse;
import com.mbc.puf.common.security.LoginUser;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletResponse;
import tools.jackson.databind.JsonNode;

/**
 * OCR 서버의 영상(MJPEG)·스냅샷·실행 버튼을 Spring 이 대신 전달한다.
 * 프런트는 OCR 서버 주소와 내부 키를 몰라도 되고, 로그인한 관리자만 볼 수 있다.
 * cameraId 는 DB camera.id 이고 OCR 서버의 config.CAMERAS / SEND_AS 의 id 와 같다.
 */
@Tag(name = "CCTV(OCR 영상)", description = "관리자 로그인 필요. OCR 서버의 탐지 영상을 Spring 이 중계. <img src> 에 바로 쓸 수 있다")
@RestController
@RequestMapping("/api/cctv")
@PreAuthorize("hasRole('REGIONAL_ADMIN')")
public class CctvController {

    private final CctvService cctvService;
    private final CctvAssignService assignService;

    public CctvController(CctvService cctvService, CctvAssignService assignService) {
        this.cctvService = cctvService;
        this.assignService = assignService;
    }

    @Operation(summary = "실시간 탐지 영상 (MJPEG)",
            description = "OCR 서버의 /stream/{cameraId} 를 그대로 중계한다. <img src=\"/api/cctv/1/stream\"> 처럼 쓰면 영상처럼 보이고 "
                    + "(로그인 쿠키가 같이 간다), 화면을 닫으면 연결이 정리된다. 해당 카메라의 인식이 꺼져 있으면 404(실행 버튼: POST /api/cctv/plate/start), "
                    + "OCR 서버가 꺼져 있으면 502.")
    @GetMapping("/{cameraId}/stream")
    public void stream(@PathVariable("cameraId") Long cameraId, HttpServletResponse response) {
        HttpResponse<InputStream> upstream = cctvService.openStream(cameraId);
        try (InputStream in = upstream.body()) {
            response.setStatus(200);
            response.setContentType(upstream.headers().firstValue(HttpHeaders.CONTENT_TYPE)
                    .orElse("multipart/x-mixed-replace; boundary=frame"));
            response.setHeader(HttpHeaders.CACHE_CONTROL, "no-store");
            response.setHeader("X-Accel-Buffering", "no");   // Nginx 뒤에서도 버퍼링 없이 바로 전달
            byte[] buf = new byte[16 * 1024];
            int n;
            while ((n = in.read(buf)) != -1) {
                response.getOutputStream().write(buf, 0, n);
                response.getOutputStream().flush();   // 프레임이 쌓이지 않고 바로 나가게
            }
        } catch (IOException e) {
            // 화면을 닫거나 새로고침해서 연결이 끊긴 것. 정상이라 조용히 끝낸다 (try 가 OCR 서버 쪽 연결도 닫아 준다)
        }
    }

    @Operation(summary = "지금 화면 한 장 (jpg)", description = "OCR 서버의 /stream/{cameraId}/snapshot 중계. 영상이 아직 준비 전이면 503.")
    @GetMapping("/{cameraId}/snapshot")
    public ResponseEntity<byte[]> snapshot(@PathVariable("cameraId") Long cameraId) {
        return ResponseEntity.ok().contentType(MediaType.IMAGE_JPEG).header(HttpHeaders.CACHE_CONTROL, "no-store")
                .body(cctvService.snapshot(cameraId));
    }

    @Operation(summary = "카메라별 인식 실행 상태",
            description = "OCR 서버의 /control/plate 중계. 카메라마다 running(실행 버튼 눌림), videoOpen(영상이 열려 돌고 있음), error 를 준다.")
    @GetMapping("/plate")
    public ApiResponse<JsonNode> plateState() {
        return ApiResponse.ok(cctvService.plateState());
    }

    @Operation(summary = "영상 재생 + 번호판 인식 시작 (실행 버튼)",
            description = "그 카메라의 영상을 처음부터 재생하고 인식·전송을 시작한다. 돌고 있던 다른 영상은 자동으로 멈춘다(영상은 한 번에 하나). "
                    + "담당 지역의 카메라만 가능하다(403).")
    @PostMapping("/plate/start")
    public ApiResponse<JsonNode> startPlate(@AuthenticationPrincipal LoginUser loginUser, @RequestParam("cameraId") Long cameraId) {
        return ApiResponse.ok(cctvService.startPlate(loginUser, cameraId));
    }

    @Operation(summary = "영상 + 번호판 인식 정지", description = "그 카메라의 영상과 인식을 멈춘다. 담당 지역의 카메라만 가능하다(403).")
    @PostMapping("/plate/stop")
    public ApiResponse<JsonNode> stopPlate(@AuthenticationPrincipal LoginUser loginUser, @RequestParam("cameraId") Long cameraId) {
        return ApiResponse.ok(cctvService.stopPlate(loginUser, cameraId));
    }

    @Operation(summary = "카메라 영상 주소 일괄 채우기 (camera.stream_url)",
            description = "담당 지역의 카메라 중 주소가 비었거나 시드 더미(rtsp://….puf.local)인 것을 채운다. 카메라 역할로 나누지 않고 카메라마다 판단한다: "
                    + "OCR 서버가 영상을 돌리는 카메라(OCR 서버 /control/plate 의 cameraId·sendAs)는 '/api/cctv/{id}/stream'(MJPEG → <img>), "
                    + "나머지는 그 좌표에서 가장 가까운 부산시 CCTV 의 HLS(.m3u8) 주소. 한 지하차도 안에서는 카메라마다 다른 CCTV 를 배정한다. "
                    + "dryRun=true(기본)는 바꿀 내용만 보여 주고 저장하지 않는다 → 확인 후 dryRun=false 로 다시 호출. "
                    + "overwrite=true 면 이미 입력된 주소도 다시 채운다. includeOcr=false 면 OCR 서버를 확인하지 않는다(전부 부산시 CCTV). "
                    + "반경(radius, m) 안에 CCTV 가 없는 카메라는 noCandidate 로 세고 건드리지 않는다. 프런트는 주소가 .m3u8 이면 HLS, 아니면 <img> 로 그린다.")
    @PostMapping("/assign-streams")
    public ApiResponse<CctvAssignResponse> assignStreams(@AuthenticationPrincipal LoginUser loginUser,
                                                         @RequestParam(name = "dryRun", defaultValue = "true") boolean dryRun,
                                                         @RequestParam(name = "overwrite", defaultValue = "false") boolean overwrite,
                                                         @RequestParam(name = "radius", defaultValue = "5000") double radius,
                                                         @RequestParam(name = "includeOcr", defaultValue = "true") boolean includeOcr) {
        return ApiResponse.ok(assignService.assign(loginUser, dryRun, overwrite, Math.min(Math.max(radius, 100), 50000), includeOcr));
    }
}
