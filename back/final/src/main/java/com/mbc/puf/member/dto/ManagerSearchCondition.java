package com.mbc.puf.member.dto;

import com.mbc.puf.common.enums.ManagerRole;
import com.mbc.puf.common.enums.ManagerStatus;
import com.mbc.puf.common.util.LikePattern;

/** 관리자 목록 조회 조건 (서비스가 만들어 매퍼에 넘긴다. null 인 항목은 조건에서 빠진다) */
public class ManagerSearchCondition {

    private LikePattern keyword;         // 아이디·이름·이메일 비교용
    private LikePattern keywordPhone;    // 전화번호 비교용 (숫자만 입력했을 때)

    private ManagerStatus status;        // 지정하면 그 상태만 (WITHDRAWN 도 명시하면 조회됨)
    private ManagerRole role;
    private Long regionId;
    private boolean includeWithdrawn;    // status 를 지정하지 않았을 때, true 면 탈퇴·거절 계정도 포함

    private int size;
    private long offset;

    public ManagerSearchCondition() {
    }

    public LikePattern getKeyword() { return keyword; }
    public void setKeyword(LikePattern keyword) { this.keyword = keyword; }

    public LikePattern getKeywordPhone() { return keywordPhone; }
    public void setKeywordPhone(LikePattern keywordPhone) { this.keywordPhone = keywordPhone; }

    public ManagerStatus getStatus() { return status; }
    public void setStatus(ManagerStatus status) { this.status = status; }

    public ManagerRole getRole() { return role; }
    public void setRole(ManagerRole role) { this.role = role; }

    public Long getRegionId() { return regionId; }
    public void setRegionId(Long regionId) { this.regionId = regionId; }

    public boolean isIncludeWithdrawn() { return includeWithdrawn; }
    public void setIncludeWithdrawn(boolean includeWithdrawn) { this.includeWithdrawn = includeWithdrawn; }

    public int getSize() { return size; }
    public void setSize(int size) { this.size = size; }

    public long getOffset() { return offset; }
    public void setOffset(long offset) { this.offset = offset; }
}
