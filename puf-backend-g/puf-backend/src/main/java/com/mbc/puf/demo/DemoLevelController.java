package com.mbc.puf.demo;

import java.util.List;
import java.util.Map;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.mbc.puf.common.enums.RiskLevel;
import com.mbc.puf.common.response.ApiResponse;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

/** 시연용 위험 5단계 버튼 API (로컬). puf.demo.enabled=true 일 때만 존재한다 */
@Tag(name = "시연(위험단계)", description = "시연 전용. 지하차도의 위험 5단계를 직접 정해 고정한다. 고정한 곳은 실제 침수 서버·호우 시나리오·평상시 가짜 갱신이 덮어쓰지 않는다")
@RestController
@RequestMapping("/api/demo/levels")
@ConditionalOnProperty(name = "puf.demo.enabled", havingValue = "true")
public class DemoLevelController {

    private final DemoLevelService levelService;

    public DemoLevelController(DemoLevelService levelService) {
        this.levelService = levelService;
    }

    public static class SetRequest {
        private List<Long> underpassIds;
        private RiskLevel level;

        public List<Long> getUnderpassIds() { return underpassIds; }
        public void setUnderpassIds(List<Long> underpassIds) { this.underpassIds = underpassIds; }
        public RiskLevel getLevel() { return level; }
        public void setLevel(RiskLevel level) { this.level = level; }
    }

    public static class ReleaseRequest {
        private List<Long> underpassIds;

        public List<Long> getUnderpassIds() { return underpassIds; }
        public void setUnderpassIds(List<Long> underpassIds) { this.underpassIds = underpassIds; }
    }

    @Operation(summary = "시연 대상 지하차도 현재 상태", description = "초량·북항·충장 지하차도의 현재 단계·점수·수위·통제 여부와 고정된 단계")
    @PreAuthorize("hasRole('REGIONAL_ADMIN')")
    @GetMapping
    public ApiResponse<List<Map<String, Object>>> list() {
        return ApiResponse.ok(levelService.list());
    }

    @Operation(summary = "위험 단계 고정", description = "level=SAFE|WATCH|CAUTION|ALERT|SEVERE. underpassIds 를 비우면 대상 전체. "
            + "점수·수위를 실제 침수모델·수위계처럼 넣으므로 알림·전광판·내비·자동 통제(경계 이상)가 원래 로직대로 일어난다. "
            + "고정한 지하차도는 실제 침수 서버가 보내는 점수·예측과 호우 시나리오·평상시 가짜 갱신이 덮어쓰지 않는다.")
    @PreAuthorize("hasRole('REGIONAL_ADMIN')")
    @PostMapping
    public ApiResponse<List<Map<String, Object>>> set(@RequestBody SetRequest request) {
        return ApiResponse.ok(levelService.set(request.getUnderpassIds(), request.getLevel()));
    }

    @Operation(summary = "고정 풀기", description = "고정을 풀면 실제 침수 서버 점수와 평상시 갱신이 다시 이어받는다(수위는 10초에 2cm씩 내려간다). 통제 해제는 직접 해야 한다.")
    @PreAuthorize("hasRole('REGIONAL_ADMIN')")
    @DeleteMapping
    public ApiResponse<List<Map<String, Object>>> release(@RequestBody(required = false) ReleaseRequest request) {
        return ApiResponse.ok(levelService.release(request == null ? null : request.getUnderpassIds()));
    }
}
