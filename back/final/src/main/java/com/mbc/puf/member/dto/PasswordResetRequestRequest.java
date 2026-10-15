package com.mbc.puf.member.dto;

import jakarta.validation.constraints.NotBlank;

public class PasswordResetRequestRequest {
	@NotBlank(message = "아이디는 필수입니다.")
	private String loginId;

	
	public PasswordResetRequestRequest() {
		// TODO Auto-generated constructor stub
	}

	public String getLoginId() {
		return loginId;
	}

	public void setLoginId(String loginId) {
		this.loginId = loginId;
	}


	public PasswordResetRequestRequest(String loginId) {
		super();
		this.loginId = loginId;
	}
	
	
}
