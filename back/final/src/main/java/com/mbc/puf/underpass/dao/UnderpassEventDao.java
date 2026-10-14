package com.mbc.puf.underpass.dao;

import java.time.LocalDateTime;
import java.util.List;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import com.mbc.puf.common.enums.RiskLevel;
import com.mbc.puf.underpass.dto.ControlHistoryItem;
import com.mbc.puf.underpass.dto.UnderpassEvent;

@Mapper
public interface UnderpassEventDao {

    // 이벤트 기록. 생성된 id가 event.id 에 채워진다
    int insertUnderpassEvent(UnderpassEvent event);

    // 그 지하차도의 가장 최근 RISK_LEVEL_UP 기록의 단계 (없으면 null → 서비스에서 SAFE로 간주)
    RiskLevel selectLatestRiskLevel(@Param("underpassId") Long underpassId);

    // 가장 최근 RISK_LEVEL_UP 이벤트 전체 (PREDICTIVE 알림의 계기 이벤트로 쓸 id가 필요해서). 없으면 null
    UnderpassEvent selectLatestRiskLevelUpEvent(@Param("underpassId") Long underpassId);

    // 제어이력(MP-16): underpass_event + display_log를 시간순으로 통합 조회 (operator_id만, 이름 조인 없음).
    // kind: "EVENT"(underpass_event만)/"DISPLAY"(display_log만)/null(전체). startAt/endAt은 기간 필터(둘 다 선택)
    List<ControlHistoryItem> selectControlHistory(@Param("underpassId") Long underpassId,
                                                   @Param("kind") String kind,
                                                   @Param("startAt") LocalDateTime startAt,
                                                   @Param("endAt") LocalDateTime endAt);
}