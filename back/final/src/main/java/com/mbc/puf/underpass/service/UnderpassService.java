package com.mbc.puf.underpass.service;

import java.time.LocalDate;
import java.util.List;

import com.mbc.puf.common.enums.TransitStatus;
import com.mbc.puf.common.response.PageResponse;
import com.mbc.puf.common.security.LoginUser;
import com.mbc.puf.underpass.dto.CameraAssignRequest;
import com.mbc.puf.underpass.dto.ControlHistoryItem;
import com.mbc.puf.underpass.dto.DisplayLogRequest;
import com.mbc.puf.underpass.dto.TransitHistoryItem;
import com.mbc.puf.underpass.dto.TransitResponse;
import com.mbc.puf.underpass.dto.UnderpassCreateRequest;
import com.mbc.puf.underpass.dto.UnderpassDetailResponse;
import com.mbc.puf.underpass.dto.UnderpassListItem;
import com.mbc.puf.underpass.dto.UnderpassUpdateRequest;
import com.mbc.puf.internal.dto.RiskScoreTrendItem;

public interface UnderpassService {

    /**
     * 목록 (관리자면 지역 상관없이 조회 가능). regionId는 필수 필터, keyword는 이름 검색(선택)
     */
    PageResponse<UnderpassListItem> getUnderpassList(LoginUser loginUser, Long regionId, String keyword,
                                                      int page, int size);

    // 상세 (관리자면 지역 상관없이 조회 가능)
    UnderpassDetailResponse getUnderpass(LoginUser loginUser, Long id);

    // 위험도 추이 (MP-05). 시간 오름차순으로 반환. 로그인 없이 공개.
    // limit: 안 주면 기본 개수(hours 없으면 24개, hours 있으면 넉넉한 안전 상한)만큼
    // hours: 주면 "최근 N시간" 범위로 거른 뒤 limit으로 상한을 건다. 둘 다 안 주면 기존과 동일(최근 24개)
    List<RiskScoreTrendItem> getRiskScoreTrend(Long id, Integer limit, Integer hours);

    // 등록. REGIONAL_ADMIN은 request.regionId가 본인 담당 지역이 아니면 차단
    UnderpassDetailResponse createUnderpass(LoginUser loginUser, UnderpassCreateRequest request);

    // 수정. REGIONAL_ADMIN은 대상이 본인 담당 지역이 아니거나, 다른 지역으로 옮기려 하면 차단
    UnderpassDetailResponse updateUnderpass(LoginUser loginUser, Long id, UnderpassUpdateRequest request);

    // 삭제 (소프트 삭제). REGIONAL_ADMIN은 본인 담당 지역 것만 가능
    void deleteUnderpass(LoginUser loginUser, Long id);

    // 차단 (MP-10). 이미 BLOCKED면 409. REGIONAL_ADMIN은 본인 담당 지역만 가능
    UnderpassDetailResponse blockUnderpass(LoginUser loginUser, Long id);

    // 해제 (MP-10). 이미 NORMAL이면 409. REGIONAL_ADMIN은 본인 담당 지역만 가능
    UnderpassDetailResponse releaseUnderpass(LoginUser loginUser, Long id);

    // 입구 카메라 지정. 카메라가 이 지하차도 소속이 아니면 400. REGIONAL_ADMIN은 본인 담당 지역만 가능
    UnderpassDetailResponse assignEntryCamera(LoginUser loginUser, Long id, CameraAssignRequest request);

    // 출구 카메라 지정. 카메라가 이 지하차도 소속이 아니면 400. REGIONAL_ADMIN은 본인 담당 지역만 가능
    UnderpassDetailResponse assignExitCamera(LoginUser loginUser, Long id, CameraAssignRequest request);

    // 통과 기록(잔류차량 등) 목록. status를 넘기면 그 상태만(예: REMAINING), null이면 전체. 조회는 관리자 모두 허용
    List<TransitResponse> getTransits(LoginUser loginUser, Long id, TransitStatus status);

    // 통과 이력 조회(검색·기간·페이징). 전부 선택 필터.
    // underpassId: 안 주면 전체 시설(SUPER_ADMIN) / 본인 담당 지역 전체 시설(REGIONAL_ADMIN)
    // keyword: 차량번호 포함검색(공백 무시), startDate~endDate: 진입일(entry_at) 기간(둘 다 포함하는 날짜 범위)
    PageResponse<TransitHistoryItem> getTransitHistory(LoginUser loginUser, Long underpassId, TransitStatus status,
                                                        String keyword, LocalDate startDate, LocalDate endDate,
                                                        int page, int size);

    // 제어이력(MP-16: underpass_event + display_log 통합). 조회는 관리자 모두 허용.
    // kind: "EVENT"/"DISPLAY"/null(전체), startDate~endDate: 기간 필터(둘 다 선택)
    List<ControlHistoryItem> getControlHistory(LoginUser loginUser, Long id, String kind,
                                                LocalDate startDate, LocalDate endDate);

    // 전광판 조작 기록. 실제 장치 제어는 없고 기록만 남긴다. REGIONAL_ADMIN은 본인 담당 지역만 가능
    void postDisplayLog(LoginUser loginUser, Long id, DisplayLogRequest request);

    // 잔류/장시간 IN_TRANSIT 차량 자동 "통과완료" 처리 (스케줄러 전용, TransitAutoExitScheduler가 주기 호출).
    // 출구 인식 없이 시간 경과만으로 자동 종료시킨다. 반환값은 처리된 건수
    int expireStaleTransits();
}