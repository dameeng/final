package com.mbc.puf.underpass.dao;

import java.time.LocalDateTime;
import java.util.List;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import com.mbc.puf.common.enums.TransitStatus;
import com.mbc.puf.underpass.dto.TransitHistoryItem;
import com.mbc.puf.underpass.dto.TransitResponse;
import com.mbc.puf.underpass.dto.UnderpassTransit;

@Mapper
public interface UnderpassTransitDao {

    // 입구 인식 시 통과 기록 생성. 생성된 id가 transit.id 에 채워진다
    int insertTransit(UnderpassTransit transit);

    // 출구 매칭 대상 조회: 이 지하차도에서 상태가 IN_TRANSIT 또는 REMAINING이고 차량번호가 같은 것 중 가장 최근에 들어온 것
    UnderpassTransit selectActiveTransitByCarNum(@Param("underpassId") Long underpassId,
                                                   @Param("carNum") String carNum);

    // 출구 보조 매칭: 같은 번호가 없을 때, from~to 사이에 들어온 것 중 숫자(digits)가 같고 길이도 같은 것 (한글 오인식 보정)
    UnderpassTransit selectSimilarActiveTransit(@Param("underpassId") Long underpassId,
                                                @Param("carNum") String carNum,
                                                @Param("digits") String digits,
                                                @Param("from") LocalDateTime from,
                                                @Param("to") LocalDateTime to);

    // 출구 매칭 완료 처리 (status=EXITED, exit_plate_log_id/exit_at 채움)
    int updateTransitExit(@Param("id") Long id, @Param("exitPlateLogId") Long exitPlateLogId,
                           @Param("exitAt") LocalDateTime exitAt);

    // BLOCK 시점에 그 지하차도에서 IN_TRANSIT 상태였던 통과 기록 전부를 REMAINING으로 일괄 처리
    int markTransitRemaining(@Param("underpassId") Long underpassId);

    // 지하차도의 통과 기록 목록. status를 넘기면 그 상태만(예: REMAINING), null이면 전체
    List<TransitResponse> selectTransitsByUnderpassId(@Param("underpassId") Long underpassId,
                                                        @Param("status") TransitStatus status);

    // 통과 이력 조회(검색·기간·페이징). underpassId/regionId/status/startAt/endAt/carNumPattern은 전부 선택.
    // regionId가 null이면 전체 시설(SUPER_ADMIN), 아니면 그 지역 소속 시설의 기록만(REGIONAL_ADMIN).
    // startAt/endAt은 entry_at 기준 기간 필터(endAt은 배타적 상한), carNumPattern은 차량번호 포함검색용 ILIKE 패턴.
    // 지하차도 이름까지 조인해서 내려준다
    List<TransitHistoryItem> selectTransitHistory(@Param("underpassId") Long underpassId,
                                                   @Param("regionId") Long regionId,
                                                   @Param("status") TransitStatus status,
                                                   @Param("startAt") LocalDateTime startAt,
                                                   @Param("endAt") LocalDateTime endAt,
                                                   @Param("carNumPattern") String carNumPattern,
                                                   @Param("size") int size, @Param("offset") long offset);

    long countTransitHistory(@Param("underpassId") Long underpassId,
                              @Param("regionId") Long regionId,
                              @Param("status") TransitStatus status,
                              @Param("startAt") LocalDateTime startAt,
                              @Param("endAt") LocalDateTime endAt,
                              @Param("carNumPattern") String carNumPattern);

    // PREDICTIVE 알림 발송 대상 조회용: 지금 그 지하차도 안에 있는(IN_TRANSIT/REMAINING) 차량번호 목록(중복제거)
    List<String> selectActiveCarNums(@Param("underpassId") Long underpassId);

    // 잔류/장시간 IN_TRANSIT 자동 종료(스케줄러 전용): entry_at 기준 minutes분이 지난 IN_TRANSIT/REMAINING 건을
    // 전부 EXITED로 일괄 처리한다. 출구 인식이 실제로 있었던 게 아니므로 exit_plate_log_id는 채우지 않는다.
    // 반환값은 처리된 행 수
    int expireStaleTransits(@Param("minutes") int minutes);
}