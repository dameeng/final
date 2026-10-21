package com.mbc.puf.cctv.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.mbc.puf.cctv.dto.BusanCctvNearbyResponse;
import com.mbc.puf.cctv.dto.BusanCctvResponse;
import com.mbc.puf.cctv.service.BusanCctvService;
import com.mbc.puf.common.exception.BusinessException;
import com.mbc.puf.common.response.ApiResponse;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

/** 부산시 교통 CCTV(공공데이터) 조회. 로그인 없이 쓸 수 있고, 영상은 응답의 url(HLS)을 프런트가 직접 재생한다 */
@Tag(name = "부산시 CCTV", description = "공공데이터포털 부산광역시 교통 CCTV 설치 현황. 로그인 불필요. url 은 HLS(.m3u8) 주소")
@RestController
@RequestMapping("/api/busan-cctvs")
public class BusanCctvController {

    private final BusanCctvService busanCctvService;

    public BusanCctvController(BusanCctvService busanCctvService) {
        this.busanCctvService = busanCctvService;
    }

    @Operation(summary = "기준 좌표 주변 CCTV",
            description = "lat/lng 에서 radius(m, 기본 5000) 안의 CCTV 를 가까운 순으로 limit(기본 15)개 준다. "
                    + "name(예: 지하차도 이름)을 주면 설치 위치 이름에 그 말이 들어간 CCTV 를 먼저 둔다. distance 는 미터. "
                    + "목록은 서버가 한 번 받아 둔 것을 쓰므로 자주 불러도 공공데이터 호출 횟수를 쓰지 않는다. 목록을 못 받은 상태면 503.")
    @GetMapping("/nearby")
    public ApiResponse<List<BusanCctvNearbyResponse>> nearby(@RequestParam("lat") double lat, @RequestParam("lng") double lng,
                                                             @RequestParam(name = "radius", defaultValue = "5000") double radius,
                                                             @RequestParam(name = "limit", defaultValue = "15") int limit,
                                                             @RequestParam(name = "name", required = false) String name) {
        if (lat < 33 || lat > 39 || lng < 124 || lng > 132) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "좌표가 국내 범위를 벗어났습니다.");
        }
        return ApiResponse.ok(busanCctvService.getNearby(lat, lng, Math.min(Math.max(radius, 100), 50000), Math.min(Math.max(limit, 1), 50), name));
    }

    @Operation(summary = "부산시 CCTV 전체 목록", description = "좌표와 HLS 주소가 있는 전체 CCTV(약 260건). 지도에 한꺼번에 찍을 때 쓴다.")
    @GetMapping
    public ApiResponse<List<BusanCctvResponse>> getAll() {
        return ApiResponse.ok(busanCctvService.getAll());
    }
}
