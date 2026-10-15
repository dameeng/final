package com.mbc.puf.board.service;

import com.mbc.puf.board.dto.NoticeCreateRequest;
import com.mbc.puf.board.dto.NoticeDetailResponse;
import com.mbc.puf.board.dto.NoticeListItem;
import com.mbc.puf.board.dto.NoticeUpdateRequest;
import com.mbc.puf.common.response.PageResponse;

public interface NoticeService {

    // 목록 (제목+내용 검색, 중요공지 필터, 페이징). keyword/important 는 null 가능
    PageResponse<NoticeListItem> getNoticeList(String keyword, Boolean important, int page, int size);

    // 상세
    NoticeDetailResponse getNotice(Long id);

    // 등록. authorId 는 컨트롤러가 세션에서 꺼내 넘긴다
    NoticeDetailResponse createNotice(Long authorId, NoticeCreateRequest request);

    // 수정
    NoticeDetailResponse updateNotice(Long id, NoticeUpdateRequest request);

    // 삭제 (소프트 삭제)
    void deleteNotice(Long id);
}
