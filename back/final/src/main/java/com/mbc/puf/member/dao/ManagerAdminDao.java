package com.mbc.puf.member.dao;

import java.util.List;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import com.mbc.puf.member.dto.ManagerListRow;
import com.mbc.puf.member.dto.ManagerSearchCondition;

/** 최고관리자용 관리자 계정 관리 (목록·승인·거절·탈퇴·지역 변경) */
@Mapper
public interface ManagerAdminDao {

    // 관리자 목록 한 페이지 (검색어가 있으면 일치 점수 순, 없으면 가입 요청일 최신순)
    List<ManagerListRow> selectManagerList(ManagerSearchCondition condition);

    long countManagerList(ManagerSearchCondition condition);

    // 승인대기 목록 (오래된 신청부터)
    List<ManagerListRow> selectPendingManagerList(@Param("size") int size, @Param("offset") long offset);

    long countPendingManagerList();

    // 단건 조회 (없으면 null)
    ManagerListRow selectManagerRowById(@Param("id") Long id);

    // 승인: 승인대기 → 활성, 담당 지역·승인자·승인 시각 기록 (반환값: 바뀐 행 수. 0이면 이미 처리된 것)
    int updateManagerApprove(@Param("id") Long id,
                             @Param("regionId") Long regionId,
                             @Param("approverId") Long approverId);

    // 거절: 승인대기 → 탈퇴(WITHDRAWN)
    int updateManagerReject(@Param("id") Long id);

    // 강제 탈퇴: 활성 → 탈퇴(WITHDRAWN)
    int updateManagerWithdraw(@Param("id") Long id);

    // 담당 지역 변경 (활성 계정만)
    int updateManagerRegion(@Param("id") Long id, @Param("regionId") Long regionId);
}
