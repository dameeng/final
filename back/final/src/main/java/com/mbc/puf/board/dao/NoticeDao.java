package com.mbc.puf.board.dao;

import java.util.List;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import com.mbc.puf.board.dto.Notice;
import com.mbc.puf.board.dto.NoticeDetailResponse;
import com.mbc.puf.board.dto.NoticeListItem;
import com.mbc.puf.board.dto.NoticeSearchCondition;

@Mapper
public interface NoticeDao {

    // 조건에 맞는 공지사항 한 페이지 (최신순)
    List<NoticeListItem> selectNoticeList(NoticeSearchCondition condition);

    // 조건에 맞는 전체 공지사항 수 (페이징 정보용)
    long countNoticeList(NoticeSearchCondition condition);

    // 공지사항 단건 (삭제된 건 제외, 없으면 null)
    NoticeDetailResponse selectNoticeById(@Param("id") Long id);

    // 공지사항 등록. 생성된 id가 notice.id 에 채워진다
    int insertNotice(Notice notice);

    // 공지사항 수정 (id/title/content/important 를 담은 notice 를 그대로 전달)
    int updateNotice(Notice notice);

    // 공지사항 삭제 (소프트 삭제)
    int softDeleteNotice(@Param("id") Long id);
}
