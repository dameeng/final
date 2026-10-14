package com.mbc.puf.common.request;

import org.springframework.http.HttpStatus;

import com.mbc.puf.common.exception.BusinessException;

/** 목록 조회의 page/size 검증과 DB 조회용 offset 계산 */
public final class PageParams {

    public static final int MAX_SIZE = 100;

    private final int page;
    private final int size;
    private final long offset;

    private PageParams(int page, int size, long offset) {
        this.page = page;
        this.size = size;
        this.offset = offset;
    }

    public static PageParams of(int page, int size) {
        if (page < 1) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "page는 1 이상이어야 합니다.");
        }
        if (size < 1 || size > MAX_SIZE) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "size는 1 이상 " + MAX_SIZE + " 이하여야 합니다.");
        }
        long offset = (long) (page - 1) * size;
        if (offset > Integer.MAX_VALUE) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "page 값이 너무 큽니다.");
        }
        return new PageParams(page, size, offset);
    }

    public int getPage() { return page; }
    public int getSize() { return size; }
    public long getOffset() { return offset; }
}
