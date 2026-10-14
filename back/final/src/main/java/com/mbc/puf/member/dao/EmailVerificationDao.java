package com.mbc.puf.member.dao;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import com.mbc.puf.common.enums.VerificationPurpose;
import com.mbc.puf.member.dto.EmailVerification;

/** 이메일 기준(SIGNUP) 인증 기록. 시간 비교는 전부 DB 시계(NOW())로 처리한다. */
@Mapper
public interface EmailVerificationDao {

	// 최근 N초 안에 발송한 건수 (재발송 쿨다운 확인)
	int countRecentSent(@Param("email") String email, @Param("purpose") VerificationPurpose purpose,
			@Param("cooldownSeconds") int cooldownSeconds);

	// 인증 기록 저장 (만료 시각 = 지금 + ttlMinutes분)
	int insertVerification(@Param("email") String email, @Param("purpose") VerificationPurpose purpose,
			@Param("code") String code, @Param("ttlMinutes") int ttlMinutes);

	// 해당 이메일의 가장 최근 기록 (없으면 null)
	EmailVerification selectLatestVerificationByEmail(@Param("email") String email,
			@Param("purpose") VerificationPurpose purpose);

	// 인증 완료 시각 기록 (이미 인증된 행이면 0)
	int updateVerifiedAt(@Param("id") Long id);

	// 최근 N분 안에 인증 완료된 건수 (가입 제출 단계에서 확인)
	int countRecentVerified(@Param("email") String email, @Param("purpose") VerificationPurpose purpose,
			@Param("validMinutes") int validMinutes);

	// 비번 변경 1단계: 코드 저장
	int insertPasswordResetForCustomer(@Param("customerId") Long customerId, @Param("code") String code,
			@Param("ttlMinutes") int ttlMinutes);

	// 비번 변경 2단계: 가장 최근 재설정 인증코드 요청 기록 조회
	EmailVerification selectLatestPasswordResetByCustomerId(@Param("customerId") Long customerId);

	// 비번 변경 3단계: 최근 인증완료 여부 확인
	int countRecentVerifiedPasswordResetByCustomerId(@Param("customerId") Long customerId,
			@Param("validMinutes") int validMinutes);

	// (관리자용)비번 변경 1단계: 코드 저장
	int insertPasswordResetForManager(@Param("managerId") Long managerId, @Param("code") String code,
			@Param("ttlMinutes") int ttlMinutes);

	// (관리자용)비번 변경 2단계: 가장 최근 재설정 인증코드 요청 기록 조회
	EmailVerification selectLatestPasswordResetByManagerId(@Param("managerId") Long managerId);

	// (관리자용)비번 변경 3단계: 최근 인증완료 여부 확인
	int countRecentVerifiedPasswordResetByManagerId(@Param("managerId") Long managerId,
			@Param("validMinutes") int validMinutes);
	
	// 최근 N초 안에 발송한 비번 변경 인증코드 건수 (재발송 쿨다운 확인)
	int countRecentSentPasswordResetByCustomerId(@Param("customerId") Long customerId,
	                                             @Param("cooldownSeconds") int cooldownSeconds);
	
	// (관리자용)최근 N초 안에 발송한 비번 변경 인증코드 건수 (재발송 쿨다운 확인)
	int countRecentSentPasswordResetByManagerId(@Param("managerId") Long managerId,
	                                            @Param("cooldownSeconds") int cooldownSeconds);
	
	
}
