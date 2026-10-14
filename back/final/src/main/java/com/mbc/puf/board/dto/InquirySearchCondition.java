package com.mbc.puf.board.dto;

import com.mbc.puf.common.enums.InquiryStatus;
import com.mbc.puf.common.util.LikePattern;

/** 접수의견 목록 조회 조건 (관리자용, MP-13). keyword는 제목+내용 통합 검색 */
public class InquirySearchCondition {

    private LikePattern keyword;
    private InquiryStatus status;   // null이면 전체
    private int size;
    private long offset;

    public InquirySearchCondition() {
    }

    public LikePattern getKeyword() { return keyword; }
    public void setKeyword(LikePattern keyword) { this.keyword = keyword; }

    public InquiryStatus getStatus() { return status; }
    public void setStatus(InquiryStatus status) { this.status = status; }

    public int getSize() { return size; }
    public void setSize(int size) { this.size = size; }

    public long getOffset() { return offset; }
    public void setOffset(long offset) { this.offset = offset; }
}
