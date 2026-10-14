package com.mbc.puf.member.dao;

import java.time.LocalDate;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import com.mbc.puf.member.dto.Employee;

@Mapper
public interface EmployeeDao {

    // 이름 + 생년월일 + 전화번호로 직원 찾기 (전화번호는 숫자만 남긴 값으로 비교. 없으면 null)
    Employee selectEmployeeByIdentity(@Param("name") String name,
                                      @Param("birthDate") LocalDate birthDate,
                                      @Param("phone") String phone);

    // id로 직원 찾기 (없으면 null)
    Employee selectEmployeeById(@Param("id") Long id);
}
