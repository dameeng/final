package com.mbc.puf.member.dto;

import com.mbc.puf.common.util.LikePattern;

/** 고객 목록 조회 조건 (서비스가 만들어 매퍼에 넘긴다. null 인 항목은 조건에서 빠진다) */
public class CustomerSearchCondition {

    // 통합 검색어 (있으면 일치 점수로 정렬)
    private LikePattern keyword;        // 아이디·이름·이메일 비교용
    private LikePattern keywordPhone;   // 전화번호 비교용 (숫자만 입력했을 때)
    private LikePattern keywordCar;     // 차량번호 비교용

    // 항목별 조건 (걸면 좁혀지고, 서로 AND)
    private LikePattern loginId;
    private LikePattern name;
    private LikePattern email;
    private LikePattern phone;
    private LikePattern carNum;

    private boolean includeWithdrawn;   // true 면 탈퇴 회원도 포함
    private int size;
    private long offset;

    public CustomerSearchCondition() {
    }

    public LikePattern getKeyword() { return keyword; }
    public void setKeyword(LikePattern keyword) { this.keyword = keyword; }

    public LikePattern getKeywordPhone() { return keywordPhone; }
    public void setKeywordPhone(LikePattern keywordPhone) { this.keywordPhone = keywordPhone; }

    public LikePattern getKeywordCar() { return keywordCar; }
    public void setKeywordCar(LikePattern keywordCar) { this.keywordCar = keywordCar; }

    public LikePattern getLoginId() { return loginId; }
    public void setLoginId(LikePattern loginId) { this.loginId = loginId; }

    public LikePattern getName() { return name; }
    public void setName(LikePattern name) { this.name = name; }

    public LikePattern getEmail() { return email; }
    public void setEmail(LikePattern email) { this.email = email; }

    public LikePattern getPhone() { return phone; }
    public void setPhone(LikePattern phone) { this.phone = phone; }

    public LikePattern getCarNum() { return carNum; }
    public void setCarNum(LikePattern carNum) { this.carNum = carNum; }

    public boolean isIncludeWithdrawn() { return includeWithdrawn; }
    public void setIncludeWithdrawn(boolean includeWithdrawn) { this.includeWithdrawn = includeWithdrawn; }

    public int getSize() { return size; }
    public void setSize(int size) { this.size = size; }

    public long getOffset() { return offset; }
    public void setOffset(long offset) { this.offset = offset; }
}
