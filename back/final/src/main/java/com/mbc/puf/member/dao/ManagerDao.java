package com.mbc.puf.member.dao;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import com.mbc.puf.member.dto.Manager;

@Mapper
public interface ManagerDao {

    // 로그인용: 아이디로 조회 (비밀번호 해시, employee.name, employee.email 포함. 없으면 null)
    Manager selectManagerByLoginId(@Param("loginId") String loginId);

    // 내 정보용: id로 조회 (employee, region 정보 포함, 비밀번호 제외. 없으면 null)
    Manager selectManagerProfileById(@Param("id") Long id);

    // 비밀번호 변경 확인용: id로 비밀번호 해시만 조회 (없으면 null)
    Manager selectManagerPasswordById(@Param("id") Long id);

    // 같은 로그인 아이디 수 (탈퇴 계정 포함: DB의 UNIQUE 제약이 탈퇴 행도 대상이므로)
    int countByLoginId(@Param("loginId") String loginId);

    // 그 직원이 가진 '탈퇴가 아닌' 계정 수 (승인대기 또는 활성)
    int countActiveByEmployeeId(@Param("employeeId") Long employeeId);

    // 관리자 계정 추가. 생성된 id가 manager.id 에 채워진다
    int insertManager(Manager manager);

    // 비밀번호 변경/재설정 공용
    int updatePassword(@Param("id") Long id, @Param("newPasswordHash") String newPasswordHash);
}
