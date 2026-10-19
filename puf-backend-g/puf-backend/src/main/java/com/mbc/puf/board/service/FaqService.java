package com.mbc.puf.board.service;

import com.mbc.puf.board.dto.FaqCreateRequest;
import com.mbc.puf.board.dto.FaqDetailResponse;
import com.mbc.puf.board.dto.FaqListItem;
import com.mbc.puf.board.dto.FaqUpdateRequest;
import com.mbc.puf.common.response.PageResponse;

public interface FaqService {

    // 목록 (질문+답변 검색, 페이징). keyword는 null 가능
    PageResponse<FaqListItem> getFaqList(String keyword, int page, int size);

    // 상세
    FaqDetailResponse getFaq(Long id);

    // 등록. authorId는 컨트롤러가 세션에서 꺼내 넘긴다
    FaqDetailResponse createFaq(Long authorId, FaqCreateRequest request);

    // 수정
    FaqDetailResponse updateFaq(Long id, FaqUpdateRequest request);

    // 삭제 (소프트 삭제)
    void deleteFaq(Long id);
}
