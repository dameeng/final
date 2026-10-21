package com.mbc.puf.cctv.service;

import java.math.BigDecimal;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mbc.puf.cctv.client.OcrServerClient;
import com.mbc.puf.cctv.dto.BusanCctvNearbyResponse;
import com.mbc.puf.cctv.dto.CctvAssignItemResponse;
import com.mbc.puf.cctv.dto.CctvAssignResponse;
import com.mbc.puf.common.exception.BusinessException;
import com.mbc.puf.common.security.LoginUser;
import com.mbc.puf.common.security.ScopeResolver;
import com.mbc.puf.underpass.entity.Camera;
import com.mbc.puf.underpass.entity.Underpass;
import com.mbc.puf.underpass.repository.CameraRepository;
import com.mbc.puf.underpass.repository.UnderpassRepository;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@Service
public class CctvAssignServiceImpl implements CctvAssignService {

    private final CameraRepository cameraRepository;
    private final UnderpassRepository underpassRepository;
    private final BusanCctvService busanCctvService;
    private final OcrServerClient ocr;
    private final ScopeResolver scopeResolver;
    private final ObjectMapper objectMapper;

    public CctvAssignServiceImpl(CameraRepository cameraRepository, UnderpassRepository underpassRepository,
                                 BusanCctvService busanCctvService, OcrServerClient ocr, ScopeResolver scopeResolver,
                                 ObjectMapper objectMapper) {
        this.cameraRepository = cameraRepository;
        this.underpassRepository = underpassRepository;
        this.busanCctvService = busanCctvService;
        this.ocr = ocr;
        this.scopeResolver = scopeResolver;
        this.objectMapper = objectMapper;
    }

    @Override
    @Transactional
    public CctvAssignResponse assign(LoginUser loginUser, boolean dryRun, boolean overwrite, double radiusM, boolean includeOcr) {
        List<Long> myRegions = scopeResolver.myRegionIds(loginUser);
        Set<Long> ocrIds = includeOcr ? ocrCameraIds() : Set.of();

        Map<Long, Underpass> underpasses = new HashMap<>();
        for (Underpass u : underpassRepository.findAll()) {
            if (!u.isDeleted() && myRegions.contains(u.getRegionId())) underpasses.put(u.getId(), u);
        }
        List<Camera> cameras = cameraRepository.findAll().stream()
                .filter(c -> !c.isDeleted() && underpasses.containsKey(c.getUnderpassId()))
                .sorted(Comparator.comparing(Camera::getUnderpassId).thenComparing(Camera::getId))
                .toList();

        List<CctvAssignItemResponse> items = new ArrayList<>();
        Map<Long, Set<String>> usedByUnderpass = new HashMap<>();   // 지하차도 안에서 이미 배정한 HLS 주소
        int changed = 0, skipped = 0, noCandidate = 0;

        for (Camera camera : cameras) {
            Underpass u = underpasses.get(camera.getUnderpassId());
            String before = camera.getStreamUrl();
            Set<String> used = usedByUnderpass.computeIfAbsent(u.getId(), k -> new HashSet<>());
            boolean hasReal = before != null && !before.isBlank() && !isPlaceholder(before);
            if (hasReal && !overwrite) {
                if (before.startsWith("http")) used.add(before);   // 이미 있는 HLS 도 '사용됨'으로 쳐서 중복 배정을 피한다
                skipped++;
                continue;
            }

            String after;
            String source;
            String cctvName = null;
            Double distance = null;
            if (ocrIds.contains(camera.getId())) {
                after = "/api/cctv/" + camera.getId() + "/stream";
                source = "OCR";
            } else {
                BigDecimal lat = camera.getLatitude() != null ? camera.getLatitude() : u.getLatitude();
                BigDecimal lng = camera.getLongitude() != null ? camera.getLongitude() : u.getLongitude();
                List<BusanCctvNearbyResponse> near = busanCctvService.getNearby(lat.doubleValue(), lng.doubleValue(), radiusM, 10, null);
                BusanCctvNearbyResponse pick = near.stream().filter(n -> !used.contains(n.url())).findFirst()
                        .orElse(near.isEmpty() ? null : near.get(0));
                if (pick == null) {
                    noCandidate++;
                    items.add(new CctvAssignItemResponse(camera.getId(), u.getId(), u.getName(), role(camera), before, null, "NONE", null, null));
                    continue;
                }
                after = pick.url();
                source = "BUSAN";
                cctvName = pick.name();
                distance = Math.round(pick.distance() * 10) / 10.0;
                used.add(after);
            }
            if (after.equals(before)) {
                skipped++;
                continue;
            }
            items.add(new CctvAssignItemResponse(camera.getId(), u.getId(), u.getName(), role(camera), before, after, source, cctvName, distance));
            if (!dryRun) camera.setStreamUrl(after);
            changed++;
        }
        return new CctvAssignResponse(dryRun, cameras.size(), changed, skipped, noCandidate, items);
    }

    // 시드 더미 주소 (rtsp://cam001.puf.local/stream 등)
    private static boolean isPlaceholder(String url) {
        return url.startsWith("rtsp://") && url.contains(".puf.local");
    }

    private static String role(Camera camera) {
        return camera.getCameraRole() == null ? null : camera.getCameraRole().name();
    }

    // OCR 서버가 영상을 돌릴 수 있는 카메라 id: /control/plate 의 cameraId 와 sendAs 모두
    private Set<Long> ocrCameraIds() {
        HttpResponse<byte[]> res = ocr.getBytes("/control/plate");
        if (res.statusCode() != 200) {
            throw new BusinessException(HttpStatus.BAD_GATEWAY, "OCR 서버에서 카메라 목록을 가져오지 못했습니다 (" + res.statusCode()
                    + "). OCR 서버 없이 채우려면 includeOcr=false 로 호출하세요.");
        }
        Set<Long> ids = new HashSet<>();
        JsonNode root = objectMapper.readTree(new String(res.body(), StandardCharsets.UTF_8));
        for (JsonNode cam : root.path("cameras")) {
            if (cam.has("cameraId")) ids.add(cam.get("cameraId").asLong());
            for (JsonNode send : cam.path("sendAs")) ids.add(send.asLong());
        }
        return ids;
    }
}
