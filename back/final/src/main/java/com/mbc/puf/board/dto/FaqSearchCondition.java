package com.mbc.puf.board.dto;

import com.mbc.puf.common.util.LikePattern;

/** FAQ 목록 조회 조건. keyword는 질문+답변 통합 검색 (null이면 전체) */
public class FaqSearchCondition {

    private LikePattern keyword;
    private int size;
    private long offset;

    public FaqSearchCondition() {
    }

    public LikePattern getKeyword() { return keyword; }
    public void setKeyword(LikePattern keyword) { this.keyword = keyword; }

    public int getSize() { return size; }
    public void setSize(int size) { this.size = size; }

    public long getOffset() { return offset; }
    public void setOffset(long offset) { this.offset = offset; }
}
