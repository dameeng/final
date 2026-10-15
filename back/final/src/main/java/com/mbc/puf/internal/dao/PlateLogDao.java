package com.mbc.puf.internal.dao;

import org.apache.ibatis.annotations.Mapper;

import com.mbc.puf.internal.dto.PlateLog;

@Mapper
public interface PlateLogDao {

    // 번호판 인식 결과 저장. 생성된 id가 plateLog.id 에 채워진다
    int insertPlateLog(PlateLog plateLog);
}
