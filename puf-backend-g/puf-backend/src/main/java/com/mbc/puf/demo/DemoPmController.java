package com.mbc.puf.demo;

import java.util.List;
import java.util.Map;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.mbc.puf.common.response.ApiResponse;
import com.mbc.puf.common.security.LoginUser;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

/** 시연용 예지보전 한 번에 버튼 API (초량지하차도 설비). puf.demo.enabled=true 일 때만 존재한다 */
@Tag(name = "시연(예지보전)", description = "시연 전용. 초량지하차도 설비 전체를 한 번에 위험/정상으로 만든다")
@RestController
@RequestMapping("/api/demo/pm")
@ConditionalOnProperty(name = "puf.demo.enabled", havingValue = "true")
@PreAuthorize("hasRole('REGIONAL_ADMIN')")
public class DemoPmController {

    private final DemoPmService service;

    public DemoPmController(DemoPmService service) {
        this.service = service;
    }

    @Operation(summary = "초량 설비 현황", description = "초량지하차도 설비별 최신 점수와 고정 상태(DANGER/NORMAL/null)")
    @GetMapping
    public ApiResponse<List<Map<String, Object>>> list() {
        return ApiResponse.ok(service.list());
    }

    @Operation(summary = "초량 설비 전체 위험으로", description = "센서 stub 을 위험으로 바꾸고 위험 점수를 바로 넣는다(위험진입 이벤트·긴급 알림·SSE 가 정상 경로로 나감). "
            + "고정된 동안 예지보전 서버의 실제 점수는 받지 않다가, 실제 점수가 위험 임계치에 닿으면 자동으로 풀린다.")
    @PostMapping("/danger")
    public ApiResponse<List<Map<String, Object>>> danger(@AuthenticationPrincipal LoginUser user) {
        return ApiResponse.ok(service.setAll(user, "DANGER"));
    }

    @Operation(summary = "초량 설비 전체 정상으로", description = "센서 stub 을 정상으로 바꾸고 정상 점수를 바로 넣는다. 실제 점수가 주의 미만이 되면 고정이 풀린다. 처리 중인 점검 이벤트는 직접 조치완료해야 한다.")
    @PostMapping("/normal")
    public ApiResponse<List<Map<String, Object>>> normal(@AuthenticationPrincipal LoginUser user) {
        return ApiResponse.ok(service.setAll(user, "NORMAL"));
    }

    @Operation(summary = "고정만 풀기", description = "점수·센서 모드는 그대로 두고 고정만 푼다. 이후 예지보전 서버 점수가 이어받는다.")
    @DeleteMapping
    public ApiResponse<List<Map<String, Object>>> release() {
        return ApiResponse.ok(service.release());
    }
}
