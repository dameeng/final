package com.mbc.puf.board.dao;

import java.util.List;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import com.mbc.puf.common.enums.InquiryStatus;
import com.mbc.puf.board.dto.Inquiry;
import com.mbc.puf.board.dto.InquiryDetailResponse;
import com.mbc.puf.board.dto.InquiryListItem;
import com.mbc.puf.board.dto.InquirySearchCondition;

@Mapper
public interface InquiryDao {

    // 그 고객이 작성한 원글 목록 (최신순, 페이징)
    List<InquiryListItem> selectInquiryListByCustomerId(@Param("customerId") Long customerId,
                                                        @Param("size") int size, @Param("offset") long offset);

    // 그 고객이 작성한 원글 전체 수 (페이징 정보용)
    long countInquiryListByCustomerId(@Param("customerId") Long customerId);

    // 관리자용 원글 목록 (검색/상태필터/페이징)
    List<InquiryListItem> selectInquiryList(InquirySearchCondition condition);

    // 관리자용 원글 전체 수 (페이징 정보용)
    long countInquiryList(InquirySearchCondition condition);

    // 고객 본인의 원글+답글 상세 (본인 것이 아니면 null)
    InquiryDetailResponse selectInquiryDetailForCustomer(@Param("id") Long id, @Param("customerId") Long customerId);

    // 관리자용 원글+답글 상세 (소유자 상관없이, 없으면 null)
    InquiryDetailResponse selectInquiryDetailForAdmin(@Param("id") Long id);

    // 원글의 답변 여부만 (없으면 null) — 답변 작성 전 상태 확인용
    InquiryStatus selectInquiryStatusById(@Param("id") Long id);

    // 원글 등록. 생성된 id가 inquiry.id 에 채워진다
    int insertInquiry(Inquiry inquiry);

    // 답글 등록 (parent_id로 원글과 연결). 같은 원글에 두 번째 답글을 넣으려 하면
    // inquiry.parent_id의 UNIQUE 제약에 걸려 DuplicateKeyException이 던져진다
    int insertReply(@Param("parentId") Long parentId, @Param("authorManagerId") Long authorManagerId,
                     @Param("content") String content);

    // 답변 완료로 상태 변경
    int updateStatusAnswered(@Param("id") Long id);

    // 답변 대기로 되돌림 (답변 삭제 시)
    int updateStatusPending(@Param("id") Long id);

    // 답글 내용 수정 (parent_id로 그 답글을 찾는다)
    int updateReplyContent(@Param("parentId") Long parentId, @Param("content") String content);

    // 답글 삭제 (소프트 삭제). parent_id의 부분 유니크 인덱스가 살아있는 답글만 세므로,
    // 이 처리 후 같은 원글에 새 답글을 다시 달 수 있다
    int softDeleteReply(@Param("parentId") Long parentId);
}