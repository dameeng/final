package com.mbc.puf.member.service;

import com.mbc.puf.common.enums.ManagerRole;
import com.mbc.puf.common.enums.ManagerStatus;
import com.mbc.puf.common.response.PageResponse;
import com.mbc.puf.member.dto.ManagerSummaryResponse;

/** 최고관리자용 관리자 계정 관리 */
public interface ManagerAdminService {

    // 관리자 목록 (검색·필터·페이징)
    PageResponse<ManagerSummaryResponse> getManagerList(String keyword, ManagerStatus status, ManagerRole role,
                                                        Long regionId, boolean includeWithdrawn,
                                                        int page, int size);

    // 승인대기 목록 (오래된 신청부터)
    PageResponse<ManagerSummaryResponse> getPendingList(int page, int size);

    // 가입 승인: 승인대기 → 활성, 담당 지역 배정
    ManagerSummaryResponse approve(Long managerId, Long regionId, Long approverId);

    // 가입 거절: 승인대기 → 탈퇴(WITHDRAWN)
    ManagerSummaryResponse reject(Long managerId);

    // 강제 탈퇴: 활성 → 탈퇴(WITHDRAWN). 최고관리자 계정은 대상이 아니다
    ManagerSummaryResponse withdraw(Long managerId);

    // 담당 지역 재배정 (활성 지역담당자만)
    ManagerSummaryResponse reassignRegion(Long managerId, Long regionId);
}
