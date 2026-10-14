package com.mbc.puf.underpass.dao;

import java.util.List;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import com.mbc.puf.common.enums.RiskLevel;
import com.mbc.puf.common.enums.UnderpassCurrentStatus;
import com.mbc.puf.underpass.dto.Underpass;
import com.mbc.puf.underpass.dto.UnderpassDetailResponse;
import com.mbc.puf.underpass.dto.UnderpassListItem;
import com.mbc.puf.underpass.dto.UnderpassSearchCondition;

@Mapper
public interface UnderpassDao {

    // 조건에 맞는 지하차도 한 페이지 (등록순)
    List<UnderpassListItem> selectUnderpassList(UnderpassSearchCondition condition);

    // 조건에 맞는 전체 지하차도 수 (페이징 정보용)
    long countUnderpassList(UnderpassSearchCondition condition);

    // 지하차도 상세 (삭제된 건 제외, 없으면 null)
    UnderpassDetailResponse selectUnderpassById(@Param("id") Long id);

    // 지하차도 등록. 생성된 id가 underpass.id 에 채워진다. current_status는 NORMAL로 고정 INSERT
    int insertUnderpass(Underpass underpass);

    // 지하차도 정보 수정 (name/regionId/roadAddress/latitude/longitude/heightM/lengthM/floodHistoryCount만)
    int updateUnderpass(Underpass underpass);

    // 지하차도 삭제 (소프트 삭제)
    int softDeleteUnderpass(@Param("id") Long id);

    // 차단/해제 시 current_status·current_block_event_id 갱신 (RELEASE면 currentBlockEventId를 null로 넘긴다)
    int updateCurrentStatus(@Param("id") Long id, @Param("currentStatus") UnderpassCurrentStatus currentStatus,
                             @Param("currentBlockEventId") Long currentBlockEventId);

    // 입구 카메라 지정 (cameraId를 null로 넘기면 지정 해제)
    int assignEntryCamera(@Param("id") Long id, @Param("cameraId") Long cameraId);

    // 지금 저장된 위험도 단계만 (없을 리 없음, DB 기본값이 '안전')
    RiskLevel selectCurrentRiskLevel(@Param("id") Long id);

    // 위험도 판정 결과로 갱신 (상승/하강 둘 다 이 메서드로 갱신)
    int updateCurrentRiskLevel(@Param("id") Long id, @Param("riskLevel") RiskLevel riskLevel);

    // 출구 카메라 지정 (cameraId를 null로 넘기면 지정 해제)
    int assignExitCamera(@Param("id") Long id, @Param("cameraId") Long cameraId);
}