package com.mbc.puf.dbtest;

import java.util.List;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import com.mbc.puf.common.enums.RiskLevel;
import com.mbc.puf.common.enums.UnderpassCurrentStatus;

/** [임시] DB 연결/enum 핸들러 검증용. 확인 끝나면 dbtest 패키지째 삭제 */
@Mapper
public interface DbTestDao {

    String selectVersion();                       // 연결 확인

    int countRegion();                            // 테이블/시드('미배정') 확인

    List<RiskLevel> selectRiskLevels();           // enum 읽기: DB '안전' → RiskLevel.SAFE

    int countUnderpassByStatus(@Param("status") UnderpassCurrentStatus status);  // enum 쓰기: WHERE 비교
}
