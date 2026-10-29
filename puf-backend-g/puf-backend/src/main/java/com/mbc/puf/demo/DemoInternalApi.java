package com.mbc.puf.demo;

import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import tools.jackson.databind.JsonNode;

/**
 * 시연용 가짜 침수모델·수위계가 서버 자신의 내부 API(/api/internal/**)를 부르는 클라이언트.
 * 실제 FastAPI·수위계가 호출하는 것과 똑같이 HTTP + X-Internal-Api-Key 로 호출하므로
 * 나중에 진짜로 바꿔도 받는 쪽 코드는 그대로다.
 */
@Component
@ConditionalOnProperty(name = "puf.demo.enabled", havingValue = "true")
public class DemoInternalApi {

    private final Environment env;
    private final String apiKey;
    private volatile RestClient client;

    public DemoInternalApi(Environment env, @Value("${puf.internal.api-key}") String apiKey) {
        this.env = env;
        this.apiKey = apiKey;
    }

    // 서버 포트는 기동 후에 정해지므로 처음 쓸 때 만든다
    private RestClient client() {
        if (client == null) {
            String port = env.getProperty("local.server.port", env.getProperty("server.port", "8080"));
            client = RestClient.builder()
                    .baseUrl("http://localhost:" + port)
                    .defaultHeader("X-Internal-Api-Key", apiKey)
                    .build();
        }
        return client;
    }

    /** GET /api/internal/weather/underpasses/{id}/rainfall → data 부분 */
    public JsonNode rainfall(Long underpassId) {
        JsonNode body = client().get().uri("/api/internal/weather/underpasses/{id}/rainfall", underpassId)
                .retrieve().body(JsonNode.class);
        return body == null ? null : body.get("data");
    }

    /** GET /api/internal/weather/underpasses/{id}/forecast → data 부분(배열) */
    public JsonNode forecast(Long underpassId) {
        JsonNode body = client().get().uri("/api/internal/weather/underpasses/{id}/forecast", underpassId)
                .retrieve().body(JsonNode.class);
        return body == null ? null : body.get("data");
    }

    public void postRiskScore(Map<String, Object> body) {
        post("/api/internal/risk-scores", body, false);
    }

    public void postRiskForecast(Map<String, Object> body) {
        post("/api/internal/risk-forecasts", body, false);
    }

    public void postWaterLevel(Map<String, Object> body) {
        post("/api/internal/water-levels", body, false);
    }

    // pin=true: 시연 위험단계 고정(DemoLevelService)이 보내는 값. X-Demo-Pin 헤더가 있어야 InternalController 가
    // 고정된 지하차도의 점수·예측을 받아들인다 (진짜 침수 서버가 보내는 값은 이 헤더가 없어 무시된다)
    public void postRiskScore(Map<String, Object> body, boolean pin) {
        post("/api/internal/risk-scores", body, pin);
    }

    public void postRiskForecast(Map<String, Object> body, boolean pin) {
        post("/api/internal/risk-forecasts", body, pin);
    }

    public void postWaterLevel(Map<String, Object> body, boolean pin) {
        post("/api/internal/water-levels", body, pin);
    }

    private void post(String path, Map<String, Object> body, boolean pin) {
        var request = client().post().uri(path).header("Content-Type", "application/json");
        if (pin) {
            request = request.header("X-Demo-Pin", "1");
        }
        request.body(body).retrieve().toBodilessEntity();
    }
}
