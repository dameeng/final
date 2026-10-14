package com.mbc.puf.threshold.dao;

import java.math.BigDecimal;
import java.util.List;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import com.mbc.puf.common.enums.RiskLevel;
import com.mbc.puf.threshold.dto.Threshold;
import com.mbc.puf.threshold.dto.ThresholdHistory;

@Mapper
public interface ThresholdDao {

    // 특정 지하차도의 임계치 3행 (risk_score_min 오름차순 = SAFE→WARNING→DANGER)
    List<Threshold> selectThresholdsByUnderpassId(@Param("underpassId") Long underpassId);

    // 특정 지하차도의 특정 단계 임계치 (없으면 null)
    Threshold selectThreshold(@Param("underpassId") Long underpassId, @Param("level") RiskLevel level);

    // 임계치 행 생성 (지하차도 등록 시 3번 호출됨). 생성된 id가 threshold.id 에 채워진다
    int insertThreshold(Threshold threshold);

    // risk_score_min/updated_by 갱신, updated_at은 NOW()로 자동 갱신
    int updateThresholdValue(@Param("underpassId") Long underpassId, @Param("level") RiskLevel level,
                              @Param("riskScoreMin") BigDecimal riskScoreMin,
                              @Param("updatedBy") Long updatedBy);

    // 변경 이력 기록 (최초 생성 포함, 값이 바뀔 때마다)
    int insertThresholdHistory(ThresholdHistory history);
}
