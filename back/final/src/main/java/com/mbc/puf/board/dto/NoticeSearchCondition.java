package com.mbc.puf.board.dto;

import com.mbc.puf.common.util.LikePattern;

/** 공지사항 목록 조회 조건 (서비스가 만들어 매퍼에 넘긴다. null 인 항목은 조건에서 빠진다) */
public class NoticeSearchCondition {

    private LikePattern keyword;   // 제목+내용 통합 검색어
    private Boolean important;     // null = 전체, true/false = 필터
    private int size;
    private long offset;

    public NoticeSearchCondition() {
    }

    public LikePattern getKeyword() { return keyword; }
    public void setKeyword(LikePattern keyword) { this.keyword = keyword; }

    public Boolean getImportant() { return important; }
    public void setImportant(Boolean important) { this.important = important; }

    public int getSize() { return size; }
    public void setSize(int size) { this.size = size; }

    public long getOffset() { return offset; }
    public void setOffset(long offset) { this.offset = offset; }
}
