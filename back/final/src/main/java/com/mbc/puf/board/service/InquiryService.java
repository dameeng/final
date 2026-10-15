package com.mbc.puf.board.service;

import com.mbc.puf.board.dto.InquiryCreateRequest;
import com.mbc.puf.board.dto.InquiryDetailResponse;
import com.mbc.puf.board.dto.InquiryListItem;
import com.mbc.puf.board.dto.InquiryReplyRequest;
import com.mbc.puf.common.enums.InquiryStatus;
import com.mbc.puf.common.response.PageResponse;

public interface InquiryService {

    // ---- 고객용 (CP-03 마이페이지 1:1 문의) ----

    // 내가 쓴 문의 목록 (페이징)
    PageResponse<InquiryListItem> getMyInquiries(Long customerId, int page, int size);

    // 내가 쓴 문의 상세 (원글+답글). 본인 것이 아니면 404
    InquiryDetailResponse getMyInquiry(Long customerId, Long id);

    // 문의 등록
    InquiryDetailResponse createInquiry(Long customerId, InquiryCreateRequest request);

    // ---- 관리자용 (MP-13 접수의견 처리) ----

    // 원글 목록 (검색/상태필터/페이징)
    PageResponse<InquiryListItem> getInquiryListForAdmin(String keyword, InquiryStatus status, int page, int size);

    // 원글+답글 상세 (소유자 상관없이)
    InquiryDetailResponse getInquiryForAdmin(Long id);

    // 답변 작성. 이미 답변된 문의면 409
    void reply(Long id, Long authorManagerId, InquiryReplyRequest request);

    // 답변 수정. 답변이 없으면(아직 PENDING) 404
    void updateReply(Long id, InquiryReplyRequest request);

    // 답변 삭제. 원글 상태를 PENDING으로 되돌려 재답변이 가능해진다
    void deleteReply(Long id);
}