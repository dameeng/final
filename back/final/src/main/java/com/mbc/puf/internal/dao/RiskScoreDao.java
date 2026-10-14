package com.mbc.puf.internal.dao;

import java.util.List;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import com.mbc.puf.internal.dto.RiskScore;
import com.mbc.puf.internal.dto.RiskScoreTrendItem;

@Mapper
public interface RiskScoreDao {

    // 위험도 예측 결과 저장. 생성된 id가 riskScore.id 에 채워진다
    int insertRiskScore(RiskScore riskScore);

    // 최근 예측 결과 N개 (predicted_at 내림차순으로 가져온다. 오름차순 정렬은 서비스에서 뒤집는다)
    // hours를 주면 "최근 N시간"으로 기간을 먼저 거른 뒤 limit으로 상한을 건다(둘 다 적용됨).
    // hours가 null이면 기존처럼 limit만으로 최근 N개를 가져온다.
    List<RiskScoreTrendItem> selectRecentRiskScores(@Param("underpassId") Long underpassId,
                                                     @Param("limit") int limit,
                                                     @Param("hours") Integer hours);
}