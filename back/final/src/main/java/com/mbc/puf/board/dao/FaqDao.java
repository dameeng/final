package com.mbc.puf.board.dao;

import java.util.List;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import com.mbc.puf.board.dto.Faq;
import com.mbc.puf.board.dto.FaqDetailResponse;
import com.mbc.puf.board.dto.FaqListItem;
import com.mbc.puf.board.dto.FaqSearchCondition;

@Mapper
public interface FaqDao {

    // 조건에 맞는 FAQ 한 페이지 (최신순)
    List<FaqListItem> selectFaqList(FaqSearchCondition condition);

    // 조건에 맞는 전체 FAQ 수 (페이징 정보용)
    long countFaqList(FaqSearchCondition condition);

    // FAQ 단건 (삭제된 건 제외, 없으면 null)
    FaqDetailResponse selectFaqById(@Param("id") Long id);

    // FAQ 등록. 생성된 id가 faq.id 에 채워진다
    int insertFaq(Faq faq);

    // FAQ 수정 (id/question/answer 를 담은 faq 를 그대로 전달)
    int updateFaq(Faq faq);

    // FAQ 삭제 (소프트 삭제)
    int softDeleteFaq(@Param("id") Long id);
}
