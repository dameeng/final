package com.mbc.puf.common.security;

import java.io.Serializable;

/**
 * 로그인한 사용자 정보. 세션에 저장되므로 Serializable 이어야 한다(세션을 파일/DB/Redis에 저장하는 경우 대비).
 *
 * @param id       고객 id 또는 관리자 id
 * @param type     "CUSTOMER" / "MANAGER"
 * @param role     "CUSTOMER" / "SUPER_ADMIN" / "REGIONAL_ADMIN"  (권한명은 ROLE_ + role)
 * @param regionId 담당 지역 id (지역담당자만 값이 있고, 고객과 최고관리자는 null)
 */
public record LoginUser(Long id, String type, String role, Long regionId) implements Serializable {
}