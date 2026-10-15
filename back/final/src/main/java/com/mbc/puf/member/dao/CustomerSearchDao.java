package com.mbc.puf.member.dao;

import java.util.List;

import org.apache.ibatis.annotations.Mapper;

import com.mbc.puf.member.dto.CustomerListRow;
import com.mbc.puf.member.dto.CustomerSearchCondition;

/** 관리자 화면용 고객 목록 조회 (검색·필터·페이징) */
@Mapper
public interface CustomerSearchDao {

    // 조건에 맞는 고객 한 페이지 (검색어가 있으면 일치 점수 순, 없으면 가입일 최신순)
    List<CustomerListRow> selectCustomerList(CustomerSearchCondition condition);

    // 조건에 맞는 전체 고객 수 (페이징 정보용)
    long countCustomerList(CustomerSearchCondition condition);
}
