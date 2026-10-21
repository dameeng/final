package com.mbc.puf.cctv.service;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import com.mbc.puf.cctv.dto.BusanCctvNearbyResponse;
import com.mbc.puf.cctv.dto.BusanCctvResponse;
import com.mbc.puf.common.exception.BusinessException;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * 공공데이터포털 BusanITSCCTV 목록을 받아 메모리에 보관한다.
 * 전체 약 260건이라 한 번 받아 두고 요청마다 거리만 계산한다 -> 개발계정 하루 500건 제한을 거의 쓰지 않는다.
 * (새로 받는 건 처음 요청 때 + puf.busan-cctv.refresh-hours 가 지난 뒤의 첫 요청. 받기에 실패하면 이전 목록을 계속 쓴다)
 * 영상은 응답의 HLS 주소(url)를 프런트가 부산시 서버에서 직접 재생한다 (Spring 이 영상을 중계하지 않음).
 */
@Service
public class BusanCctvServiceImpl implements BusanCctvService {

    private static final Logger log = LoggerFactory.getLogger(BusanCctvServiceImpl.class);
    private static final Pattern STREAM_NO = Pattern.compile("cctv_(\\d+)");
    private static final int PAGE_SIZE = 100;

    private final String endpoint;
    private final String serviceKey;
    private final Duration refreshAfter;
    private final Duration timeout;
    private final ObjectMapper objectMapper;
    private final HttpClient http;

    private volatile List<BusanCctvResponse> cache = List.of();
    private volatile long loadedAt = 0;

    public BusanCctvServiceImpl(@Value("${puf.busan-cctv.url:https://apis.data.go.kr/6260000/BusanITSCCTV/CCTVList}") String endpoint,
                                @Value("${puf.busan-cctv.service-key:}") String serviceKey,
                                @Value("${puf.busan-cctv.refresh-hours:6}") long refreshHours,
                                @Value("${puf.ocr-server.timeout-seconds:10}") long timeoutSeconds,
                                ObjectMapper objectMapper) {
        this.endpoint = endpoint;
        this.serviceKey = serviceKey == null ? "" : serviceKey.trim();
        this.refreshAfter = Duration.ofHours(refreshHours);
        this.timeout = Duration.ofSeconds(timeoutSeconds);
        this.objectMapper = objectMapper;
        this.http = HttpClient.newBuilder().connectTimeout(timeout).build();
    }

    @Override
    public List<BusanCctvResponse> getAll() {
        refreshIfNeeded();
        if (cache.isEmpty()) {
            throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "부산시 CCTV 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
        }
        return cache;
    }

    @Override
    public List<BusanCctvNearbyResponse> getNearby(double lat, double lng, double radiusM, int limit, String nameHint) {
        String hint = nameHint == null ? "" : nameHint.replaceAll("\\s", "");
        return getAll().stream()
                .map(c -> new BusanCctvNearbyResponse(c.id(), c.name(), c.address(), c.url(), c.lat(), c.lng(),
                        distanceM(lat, lng, c.lat(), c.lng())))
                .filter(c -> c.distance() <= radiusM)
                .sorted(Comparator.<BusanCctvNearbyResponse>comparingInt(c -> !hint.isEmpty() && c.name().replaceAll("\\s", "").contains(hint) ? 0 : 1)
                        .thenComparingDouble(BusanCctvNearbyResponse::distance))
                .limit(limit)
                .toList();
    }

    // ---------------------------------------------------------------

    private synchronized void refreshIfNeeded() {
        boolean fresh = loadedAt != 0 && System.currentTimeMillis() - loadedAt < refreshAfter.toMillis();
        if (fresh) return;
        try {
            cache = fetchAll();
            loadedAt = System.currentTimeMillis();
        } catch (RuntimeException e) {
            // 실패해도 매 요청마다 다시 두드리지 않게(호출 횟수 제한 보호) 1분 뒤에 다시 시도한다. 그동안은 이전 목록을 쓴다
            log.warn("부산시 CCTV 목록 갱신 실패 (이전 목록 {}건 유지): {}", cache.size(), e.getMessage());
            loadedAt = System.currentTimeMillis() - refreshAfter.toMillis() + Duration.ofMinutes(1).toMillis();
        }
    }

    private List<BusanCctvResponse> fetchAll() {
        if (serviceKey.isEmpty()) {
            throw new IllegalStateException("puf.busan-cctv.service-key 가 비어 있습니다 (secret.busan-cctv.service-key)");
        }
        List<BusanCctvResponse> result = new ArrayList<>();
        int page = 1;
        int total = Integer.MAX_VALUE;
        while ((page - 1) * PAGE_SIZE < total && page <= 20) {
            JsonNode body = get(page);
            JsonNode code = body.path("resultCode");
            if (!code.isMissingNode() && !"00".equals(code.asText())) {
                throw new IllegalStateException("공공데이터 응답 오류 " + code.asText() + " " + body.path("resultMsg").asText());
            }
            JsonNode content = body.path("content");
            total = content.path("totalCount").asInt(0);
            for (JsonNode item : content.path("items")) {
                BusanCctvResponse camera = toCamera(item);
                if (camera != null) result.add(camera);
            }
            page++;
        }
        log.info("부산시 CCTV 목록 {}건 갱신", result.size());
        return List.copyOf(result);
    }

    private JsonNode get(int page) {
        // 포털의 Encoding 키(%가 들어 있음)는 그대로, Decoding 키는 인코딩해서 보낸다
        String key = serviceKey.contains("%") ? serviceKey : URLEncoder.encode(serviceKey, StandardCharsets.UTF_8);
        URI uri = URI.create(endpoint + "?serviceKey=" + key + "&pageNo=" + page + "&numOfRows=" + PAGE_SIZE);
        try {
            HttpResponse<String> res = http.send(HttpRequest.newBuilder(uri).timeout(timeout).GET().build(),
                    HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (res.statusCode() != 200) throw new IllegalStateException("HTTP " + res.statusCode());
            return objectMapper.readTree(res.body());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("요청 중단");
        } catch (IOException e) {
            throw new IllegalStateException("연결 실패: " + e.getMessage());
        }
    }

    private BusanCctvResponse toCamera(JsonNode item) {
        String url = item.path("hlsAddr").asText("");
        double lat = item.path("lat").asDouble(Double.NaN);
        double lng = item.path("lot").asDouble(Double.NaN);
        if (!url.matches("(?i)^https?://.+") || Double.isNaN(lat) || Double.isNaN(lng)) return null;
        String name = item.path("instlPos").asText("").trim();
        Matcher m = STREAM_NO.matcher(url);
        String id = m.find() ? m.group(1) : Integer.toHexString(url.hashCode());   // 주소의 cctv_N 번호를 id 로
        return new BusanCctvResponse(id, name.isEmpty() ? "CCTV " + id : name, "", url, lat, lng);
    }

    private static double distanceM(double lat1, double lng1, double lat2, double lng2) {
        double rad = Math.PI / 180;
        double a = Math.pow(Math.sin((lat2 - lat1) * rad / 2), 2)
                + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.pow(Math.sin((lng2 - lng1) * rad / 2), 2);
        return 6371000 * 2 * Math.asin(Math.min(1, Math.sqrt(a)));
    }
}