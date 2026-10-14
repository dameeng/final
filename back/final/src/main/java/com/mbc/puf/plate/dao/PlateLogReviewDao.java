package com.mbc.puf.plate.dao;

import java.util.List;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import com.mbc.puf.plate.dto.PlateLogPendingItem;
import com.mbc.puf.plate.dto.PlateLogRow;

@Mapper
public interface PlateLogReviewDao {

    // review_status=PENDING 목록 (오래된 순 — 마감 임박한 것부터 보이게)
    // regionId가 null이면 전체(SUPER_ADMIN), 아니면 그 지역 소속 지하차도의 판별대기만(REGIONAL_ADMIN)
    // underpassId가 넘어오면 그 지하차도 것만 추가로 더 좁혀서(대시보드에서 선택한 시설 단위 조회용)
    List<PlateLogPendingItem> selectPendingList(@Param("regionId") Long regionId,
                                                 @Param("underpassId") Long underpassId);

    // 지역 권한 확인/재조회용 (카메라 조인으로 underpassId까지). 없으면 null
    PlateLogRow selectRowById(@Param("id") Long id);

    // 수동 판별 처리: corrected_num/car_id 갱신, review_status=CONFIRMED, reviewed_by/reviewed_at 채움
    int updateReview(@Param("id") Long id, @Param("correctedNum") String correctedNum, @Param("carId") Long carId,
                      @Param("reviewedBy") Long reviewedBy);

    // 마감(review_deadline) 지난 PENDING 건을 전부 AUTO_PROCESSED로 (스케줄러용). 처리된 건수 반환
    int autoProcessExpired();
}