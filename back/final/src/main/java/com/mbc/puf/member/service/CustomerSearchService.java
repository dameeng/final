package com.mbc.puf.member.service;

import com.mbc.puf.common.response.PageResponse;
import com.mbc.puf.member.dto.CustomerListItem;
import com.mbc.puf.member.dto.CustomerProfileUpdateRequest;

public interface CustomerSearchService {

    /**
     * 관리자 화면의 고객 목록 조회.
     * keyword 는 아이디·이름·이메일·전화번호·차량번호를 한꺼번에 찾고(일치 점수 순), 나머지 조건은 걸면 좁혀진다.
     */
    PageResponse<CustomerListItem> search(String keyword, String loginId, String name, String email,
                                          String phone, String carNum, boolean includeWithdrawn,
                                          int page, int size);

    // 관리자가 고객 정보 수정 (본인 마이페이지와 같은 항목: 전화번호/긴급연락처/주소). 없으면 404
    void updateCustomer(Long customerId, CustomerProfileUpdateRequest request);

    // 강제 탈퇴. 이미 탈퇴한 회원이면 409
    void forceWithdraw(Long customerId);
}