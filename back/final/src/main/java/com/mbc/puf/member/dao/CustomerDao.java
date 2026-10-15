package com.mbc.puf.member.dao;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import com.mbc.puf.member.dto.Customer;

@Mapper
public interface CustomerDao {

    // 같은 로그인 아이디 수 (탈퇴 회원 포함: DB의 UNIQUE 제약이 탈퇴 회원 행도 대상이므로)
    int countByLoginId(@Param("loginId") String loginId);

    // 같은 이메일 수 (탈퇴 회원 포함)
    int countByEmail(@Param("email") String email);

    // 고객 추가. 생성된 id가 customer.id 에 채워진다
    int insertCustomer(Customer customer);

    // 로그인용: 아이디로 조회 (비밀번호 해시 포함, 없으면 null)
    Customer selectCustomerByLoginId(@Param("loginId") String loginId);

    // 마이페이지 조회용: id로 전체 프로필 조회 (비밀번호 제외, 없으면 null)
    Customer selectCustomerById(@Param("id") Long id);

    // 비밀번호 변경 확인용: id로 비밀번호 해시만 조회 (없으면 null)
    Customer selectCustomerPasswordById(@Param("id") Long id);

    // 마이페이지 정보 수정
    int updateCustomerProfile(@Param("id") Long id, @Param("phone") String phone,
                              @Param("emergency") String emergency, @Param("zipcode") String zipcode,
                              @Param("roadAddress") String roadAddress, @Param("detailAddress") String detailAddress);

    // 비밀번호 변경/재설정 공용
    int updatePassword(@Param("id") Long id, @Param("newPasswordHash") String newPasswordHash);

    // 회원 탈퇴 (본인)
    int updateWithdraw(@Param("id") Long id);
}
