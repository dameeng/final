package com.mbc.puf.board.service;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mbc.puf.board.dao.NoticeDao;
import com.mbc.puf.board.dto.Notice;
import com.mbc.puf.board.dto.NoticeCreateRequest;
import com.mbc.puf.board.dto.NoticeDetailResponse;
import com.mbc.puf.board.dto.NoticeListItem;
import com.mbc.puf.board.dto.NoticeSearchCondition;
import com.mbc.puf.board.dto.NoticeUpdateRequest;
import com.mbc.puf.common.exception.BusinessException;
import com.mbc.puf.common.request.PageParams;
import com.mbc.puf.common.response.PageResponse;
import com.mbc.puf.common.util.LikePattern;

@Service
public class NoticeServiceImpl implements NoticeService {

    private final NoticeDao noticeDao;

    public NoticeServiceImpl(NoticeDao noticeDao) {
        this.noticeDao = noticeDao;
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<NoticeListItem> getNoticeList(String keyword, Boolean important, int page, int size) {
        PageParams pageParams = PageParams.of(page, size);

        NoticeSearchCondition condition = new NoticeSearchCondition();
        condition.setKeyword(LikePattern.of(keyword));   // 비어 있으면 null → 검색어 없이 전체 조회
        condition.setImportant(important);               // null 이면 전체, 아니면 필터
        condition.setSize(pageParams.getSize());
        condition.setOffset(pageParams.getOffset());

        long total = noticeDao.countNoticeList(condition);
        List<NoticeListItem> items = (total == 0) ? List.of() : noticeDao.selectNoticeList(condition);

        return new PageResponse<>(items, pageParams.getPage(), pageParams.getSize(), total);
    }

    @Override
    @Transactional(readOnly = true)
    public NoticeDetailResponse getNotice(Long id) {
        return getActiveNotice(id);
    }

    @Override
    @Transactional
    public NoticeDetailResponse createNotice(Long authorId, NoticeCreateRequest request) {
        Notice notice = new Notice();
        notice.setTitle(request.getTitle().trim());
        notice.setContent(request.getContent());
        notice.setImportant(request.isImportant());
        notice.setAuthorId(authorId);

        noticeDao.insertNotice(notice);   // 생성된 id가 notice.id 에 채워진다

        return getActiveNotice(notice.getId());   // 작성자 이름까지 채워서 반환하려고 다시 조회
    }

    @Override
    @Transactional
    public NoticeDetailResponse updateNotice(Long id, NoticeUpdateRequest request) {
        getActiveNotice(id);   // 존재/삭제 여부 확인, 없으면 404

        Notice notice = new Notice();
        notice.setId(id);
        notice.setTitle(request.getTitle().trim());
        notice.setContent(request.getContent());
        notice.setImportant(request.isImportant());

        noticeDao.updateNotice(notice);

        return getActiveNotice(id);
    }

    @Override
    @Transactional
    public void deleteNotice(Long id) {
        if (noticeDao.softDeleteNotice(id) == 0) {
            throw new BusinessException(HttpStatus.NOT_FOUND, "존재하지 않는 공지사항입니다. id=" + id);
        }
    }

    // ---- 내부 메서드 ----

    // 삭제되지 않은 공지사항 상세 조회, 없으면 404
    private NoticeDetailResponse getActiveNotice(Long id) {
        NoticeDetailResponse notice = noticeDao.selectNoticeById(id);
        if (notice == null) {
            throw new BusinessException(HttpStatus.NOT_FOUND, "존재하지 않는 공지사항입니다. id=" + id);
        }
        return notice;
    }
}
