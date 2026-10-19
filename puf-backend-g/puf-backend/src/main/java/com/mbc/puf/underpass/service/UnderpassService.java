package com.mbc.puf.underpass.service;

import java.util.List;

import com.mbc.puf.common.enums.TransitStatus;
import com.mbc.puf.common.enums.UnderpassCurrentStatus;
import com.mbc.puf.common.request.PageQuery;
import com.mbc.puf.common.request.PeriodQuery;
import com.mbc.puf.common.request.ScopeQuery;
import com.mbc.puf.common.request.VehicleQuery;
import com.mbc.puf.common.response.PageResponse;
import com.mbc.puf.common.security.LoginUser;
import com.mbc.puf.internal.dto.RiskScoreTrendItem;
import com.mbc.puf.underpass.dto.GateCameraRequest;
import com.mbc.puf.underpass.dto.ControlHistoryItem;
import com.mbc.puf.underpass.dto.TransitHistoryItem;
import com.mbc.puf.underpass.dto.UnderpassCreateRequest;
import com.mbc.puf.underpass.dto.UnderpassDetailResponse;
import com.mbc.puf.underpass.dto.UnderpassListItem;
import com.mbc.puf.underpass.dto.UnderpassUpdateRequest;

public interface UnderpassService {

    /** 지하차도 목록 정렬 기준 */
    enum Sort {
        NAME,        // 이름 가나다순 (기본)
        RISK_SCORE,  // 최신 위험점수 높은 순 (점수 없으면 맨 뒤)
        LATEST       // 최근 등록순
    }

    // 지하차도 목록 (공개). regionId·keyword(이름)·status 는 선택
    PageResponse<UnderpassListItem> getUnderpassList(Long regionId, String keyword, UnderpassCurrentStatus status,
                                                     Sort sort, PageQuery page);

    UnderpassDetailResponse getUnderpass(Long id);

    // 위험도 추이 (그래프용 시계열이라 List, 시간 오름차순)
    List<RiskScoreTrendItem> getRiskScoreTrend(Long id, Integer limit, Integer hours);

    UnderpassDetailResponse createUnderpass(LoginUser loginUser, UnderpassCreateRequest request);

    UnderpassDetailResponse updateUnderpass(LoginUser loginUser, Long id, UnderpassUpdateRequest request);

    void deleteUnderpass(LoginUser loginUser, Long id);

    UnderpassDetailResponse blockUnderpass(LoginUser loginUser, Long id);

    UnderpassDetailResponse releaseUnderpass(LoginUser loginUser, Long id);

    // 상행/하행 입·출구 카메라 4자리 한 번에 지정 (null = 지정 해제)
    UnderpassDetailResponse assignGateCameras(LoginUser loginUser, Long id, GateCameraRequest request);

    // 통과 기록 목록 (잔류차량 목록 = status=REMAINING&underpassId=..). Scope/Vehicle/Period/Page 공통 조건
    PageResponse<TransitHistoryItem> getTransitHistory(LoginUser loginUser, ScopeQuery scope, TransitStatus status,
                                                       VehicleQuery vehicle, PeriodQuery period, PageQuery page);

    // 제어이력 (이벤트 + 전광판 문구 변경, 최신순). kind: EVENT/DISPLAY/null(전체)
    PageResponse<ControlHistoryItem> getControlHistory(Long id, String kind, PeriodQuery period, PageQuery page);

    // 잔류/장시간 IN_TRANSIT 자동 종료 (스케줄러 전용). 처리된 행 수
    int expireStaleTransits();
}
