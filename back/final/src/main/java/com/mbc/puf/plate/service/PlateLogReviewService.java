package com.mbc.puf.plate.service;

import java.util.List;

import com.mbc.puf.common.security.LoginUser;
import com.mbc.puf.plate.dto.PlateLogPendingItem;
import com.mbc.puf.plate.dto.PlateLogReviewRequest;
import com.mbc.puf.plate.dto.PlateLogReviewResponse;

/** LOW_CONFIDENCE로 PENDING 걸린 번호판 인식 결과의 수동 판별. 조회는 관리자 전체, 판별은 해당 지하차도 담당 지역만 */
public interface PlateLogReviewService {

    // 판별대기 목록 (마감 임박한 것부터). underpassId가 null이면 담당 범위 전체, 있으면 그 지하차도만
    // (대시보드에서 시설 하나를 선택해서 볼 때 쓰는 필터)
    List<PlateLogPendingItem> getPendingList(LoginUser loginUser, Long underpassId);

    // 수동 판별: correctedNum으로 재매칭 후 CONFIRMED로 확정
    PlateLogReviewResponse review(LoginUser loginUser, Long id, PlateLogReviewRequest request);

    // 마감 지난 PENDING 건을 AUTO_PROCESSED로 일괄 처리 (스케줄러가 호출)
    void autoProcessExpired();
}