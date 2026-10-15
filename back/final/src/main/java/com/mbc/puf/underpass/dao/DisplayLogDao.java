package com.mbc.puf.underpass.dao;

import org.apache.ibatis.annotations.Mapper;

import com.mbc.puf.underpass.dto.DisplayLog;

@Mapper
public interface DisplayLogDao {

    // 전광판 조작 기록. 생성된 id가 displayLog.id 에 채워진다
    int insertDisplayLog(DisplayLog displayLog);
}
