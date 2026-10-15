package com.mbc.puf.region.dao;

import java.util.List;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import com.mbc.puf.region.dto.RegionResponse;

@Mapper
public interface RegionDao {

    // 삭제되지 않은 지역 전체 ('미배정' 포함)
    List<RegionResponse> selectRegionList();

    // 삭제되지 않은 지역 단건 (없으면 null)
    RegionResponse selectRegionById(@Param("id") Long id);

    // 이름으로 삭제되지 않은 지역 조회 (중복 확인, '미배정' 찾기용. 없으면 null)
    RegionResponse selectRegionByName(@Param("name") String name);

    // 지역 추가. 생성된 id가 region.id 에 채워진다
    int insertRegion(RegionResponse region);

    // 이름 변경 (반환값: 변경된 행 수)
    int updateRegionName(@Param("id") Long id, @Param("name") String name);

    // 지역 삭제 1단계: 소속 지하차도를 다른 지역(미배정)으로 이동
    int updateUnderpassRegion(@Param("fromRegionId") Long fromRegionId,
                              @Param("toRegionId") Long toRegionId);

    // 지역 삭제 2단계: 소속 지역담당자를 다른 지역(미배정)으로 이동
    int updateManagerRegion(@Param("fromRegionId") Long fromRegionId,
                            @Param("toRegionId") Long toRegionId);

    // 지역 삭제 3단계: 소프트 삭제 (is_deleted = true)
    int softDeleteRegion(@Param("id") Long id);
}