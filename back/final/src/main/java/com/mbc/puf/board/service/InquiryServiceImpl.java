package com.mbc.puf.board.service;

import java.util.List;

import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mbc.puf.board.dao.InquiryDao;
import com.mbc.puf.board.dto.Inquiry;
import com.mbc.puf.board.dto.InquiryCreateRequest;
import com.mbc.puf.board.dto.InquiryDetailResponse;
import com.mbc.puf.board.dto.InquiryListItem;
import com.mbc.puf.board.dto.InquiryReplyRequest;
import com.mbc.puf.board.dto.InquirySearchCondition;
import com.mbc.puf.common.enums.InquiryStatus;
import com.mbc.puf.common.exception.BusinessException;
import com.mbc.puf.common.request.PageParams;
import com.mbc.puf.common.response.PageResponse;
import com.mbc.puf.common.util.LikePattern;

@Service
public class InquiryServiceImpl implements InquiryService {

    private final InquiryDao inquiryDao;

    public InquiryServiceImpl(InquiryDao inquiryDao) {
        this.inquiryDao = inquiryDao;
    }

    // ---- 고객용 ----

    @Override
    @Transactional(readOnly = true)
    public PageResponse<InquiryListItem> getMyInquiries(Long customerId, int page, int size) {
        PageParams pageParams = PageParams.of(page, size);

        long total = inquiryDao.countInquiryListByCustomerId(customerId);
        List<InquiryListItem> items = (total == 0) ? List.of()
                : inquiryDao.selectInquiryListByCustomerId(customerId, pageParams.getSize(), pageParams.getOffset());

        return new PageResponse<>(items, pageParams.getPage(), pageParams.getSize(), total);
    }

    @Override
    @Transactional(readOnly = true)
    public InquiryDetailResponse getMyInquiry(Long customerId, Long id) {
        InquiryDetailResponse inquiry = inquiryDao.selectInquiryDetailForCustomer(id, customerId);
        if (inquiry == null) {
            throw new BusinessException(HttpStatus.NOT_FOUND, "존재하지 않는 문의입니다. id=" + id);
        }
        return inquiry;
    }

    @Override
    @Transactional
    public InquiryDetailResponse createInquiry(Long customerId, InquiryCreateRequest request) {
        Inquiry inquiry = new Inquiry();
        inquiry.setCustomerId(customerId);
        inquiry.setTitle(request.getTitle().trim());
        inquiry.setContent(request.getContent());

        inquiryDao.insertInquiry(inquiry);   // 생성된 id가 inquiry.id 에 채워진다

        return getMyInquiry(customerId, inquiry.getId());
    }

    // ---- 관리자용 ----

    @Override
    @Transactional(readOnly = true)
    public PageResponse<InquiryListItem> getInquiryListForAdmin(String keyword, InquiryStatus status,
                                                                 int page, int size) {
        PageParams pageParams = PageParams.of(page, size);

        InquirySearchCondition condition = new InquirySearchCondition();
        condition.setKeyword(LikePattern.of(keyword));
        condition.setStatus(status);
        condition.setSize(pageParams.getSize());
        condition.setOffset(pageParams.getOffset());

        long total = inquiryDao.countInquiryList(condition);
        List<InquiryListItem> items = (total == 0) ? List.of() : inquiryDao.selectInquiryList(condition);

        return new PageResponse<>(items, pageParams.getPage(), pageParams.getSize(), total);
    }

    @Override
    @Transactional(readOnly = true)
    public InquiryDetailResponse getInquiryForAdmin(Long id) {
        InquiryDetailResponse inquiry = inquiryDao.selectInquiryDetailForAdmin(id);
        if (inquiry == null) {
            throw new BusinessException(HttpStatus.NOT_FOUND, "존재하지 않는 문의입니다. id=" + id);
        }
        return inquiry;
    }

    @Override
    @Transactional
    public void reply(Long id, Long authorManagerId, InquiryReplyRequest request) {
        InquiryStatus status = inquiryDao.selectInquiryStatusById(id);
        if (status == null) {
            throw new BusinessException(HttpStatus.NOT_FOUND, "존재하지 않는 문의입니다. id=" + id);
        }
        if (status != InquiryStatus.PENDING) {
            throw new BusinessException(HttpStatus.CONFLICT, "이미 답변이 등록된 문의입니다.");
        }

        try {
            inquiryDao.insertReply(id, authorManagerId, request.getContent());
        } catch (DuplicateKeyException e) {
            // 동시에 답변이 등록된 경우에 대한 방어 (parent_id UNIQUE 제약)
            throw new BusinessException(HttpStatus.CONFLICT, "이미 답변이 등록된 문의입니다.");
        }

        inquiryDao.updateStatusAnswered(id);
    }

    @Override
    @Transactional
    public void updateReply(Long id, InquiryReplyRequest request) {
        InquiryStatus status = inquiryDao.selectInquiryStatusById(id);
        if (status == null) {
            throw new BusinessException(HttpStatus.NOT_FOUND, "존재하지 않는 문의입니다. id=" + id);
        }
        if (status != InquiryStatus.ANSWERED) {
            throw new BusinessException(HttpStatus.CONFLICT, "아직 답변이 등록되지 않은 문의입니다.");
        }
        inquiryDao.updateReplyContent(id, request.getContent());
    }

    @Override
    @Transactional
    public void deleteReply(Long id) {
        InquiryStatus status = inquiryDao.selectInquiryStatusById(id);
        if (status == null) {
            throw new BusinessException(HttpStatus.NOT_FOUND, "존재하지 않는 문의입니다. id=" + id);
        }
        if (status != InquiryStatus.ANSWERED) {
            throw new BusinessException(HttpStatus.CONFLICT, "아직 답변이 등록되지 않은 문의입니다.");
        }
        inquiryDao.softDeleteReply(id);
        inquiryDao.updateStatusPending(id);   // 다시 승인대기(=답변대기) 목록에 노출되어 재답변 가능
    }
}