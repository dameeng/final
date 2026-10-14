package com.mbc.puf.underpass.dto;

import com.mbc.puf.common.util.LikePattern;

/** 지하차도 목록 조회 조건. regionId는 서비스에서 항상 채워서 넘긴다
 *  (SUPER_ADMIN은 요청받은 값, REGIONAL_ADMIN은 본인 담당 지역으로 강제) */
public class UnderpassSearchCondition {

    private Long regionId;
    private LikePattern keyword;   // 이름 검색어
    private int size;
    private long offset;

    public UnderpassSearchCondition() {
    }

    public Long getRegionId() { return regionId; }
    public void setRegionId(Long regionId) { this.regionId = regionId; }

    public LikePattern getKeyword() { return keyword; }
    public void setKeyword(LikePattern keyword) { this.keyword = keyword; }

    public int getSize() { return size; }
    public void setSize(int size) { this.size = size; }

    public long getOffset() { return offset; }
    public void setOffset(long offset) { this.offset = offset; }
}
