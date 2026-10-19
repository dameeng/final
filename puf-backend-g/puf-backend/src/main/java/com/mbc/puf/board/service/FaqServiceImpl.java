package com.mbc.puf.board.service;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mbc.puf.board.dto.FaqCreateRequest;
import com.mbc.puf.board.dto.FaqDetailResponse;
import com.mbc.puf.board.dto.FaqListItem;
import com.mbc.puf.board.dto.FaqUpdateRequest;
import com.mbc.puf.board.entity.Faq;
import com.mbc.puf.board.repository.FaqRepository;
import com.mbc.puf.common.exception.BusinessException;
import com.mbc.puf.common.jpa.DbClock;
import com.mbc.puf.common.query.PagedQuery;
import com.mbc.puf.common.query.QueryConditions;
import com.mbc.puf.common.request.PageParams;
import com.mbc.puf.common.response.PageResponse;

import jakarta.persistence.EntityManager;

@Service
public class FaqServiceImpl implements FaqService {

    private static final String FROM = " from Faq f join Manager m on m.id = f.authorId"
            + " join Employee e on e.id = m.employeeId";

    private final FaqRepository faqRepository;
    private final DbClock dbClock;
    private final EntityManager em;

    public FaqServiceImpl(FaqRepository faqRepository, DbClock dbClock, EntityManager em) {
        this.faqRepository = faqRepository;
        this.dbClock = dbClock;
        this.em = em;
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<FaqListItem> getFaqList(String keyword, int page, int size) {
        PageParams pageParams = PageParams.of(page, size);
        QueryConditions c = new QueryConditions()
                .add("f.deleted = false")
                .containsIfPresent(keyword, "f.question", "f.answer");   // 질문+답변 통합 검색

        return PagedQuery.fetch(em, "select f, e.name" + FROM, "select count(f)" + FROM, c,
                " order by f.createdAt desc, f.id desc", Object[].class, row -> {
                    Faq f = (Faq) row[0];
                    FaqListItem item = new FaqListItem();
                    item.setId(f.getId());
                    item.setQuestion(f.getQuestion());
                    item.setAuthorName((String) row[1]);
                    item.setCreatedAt(f.getCreatedAt());
                    return item;
                }, pageParams);
    }

    @Override
    @Transactional(readOnly = true)
    public FaqDetailResponse getFaq(Long id) {
        return toDetail(getActiveFaq(id));
    }

    @Override
    @Transactional
    public FaqDetailResponse createFaq(Long authorId, FaqCreateRequest request) {
        Faq faq = new Faq();
        faq.setQuestion(request.getQuestion().trim());
        faq.setAnswer(request.getAnswer());
        faq.setAuthorId(authorId);
        faqRepository.saveAndFlush(faq);
        return toDetail(faq);
    }

    @Override
    @Transactional
    public FaqDetailResponse updateFaq(Long id, FaqUpdateRequest request) {
        Faq faq = getActiveFaq(id);   // 존재/삭제 여부 확인, 없으면 404
        faq.setQuestion(request.getQuestion().trim());
        faq.setAnswer(request.getAnswer());
        faq.setUpdatedAt(dbClock.now());
        return toDetail(faq);
    }

    @Override
    @Transactional
    public void deleteFaq(Long id) {
        getActiveFaq(id).setDeleted(true);
    }

    private Faq getActiveFaq(Long id) {
        return faqRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "존재하지 않는 FAQ입니다. id=" + id));
    }

    private FaqDetailResponse toDetail(Faq f) {
        FaqDetailResponse detail = new FaqDetailResponse();
        detail.setId(f.getId());
        detail.setQuestion(f.getQuestion());
        detail.setAnswer(f.getAnswer());
        detail.setAuthorId(f.getAuthorId());
        detail.setAuthorName(BoardAuthors.managerName(em, f.getAuthorId()));
        detail.setCreatedAt(f.getCreatedAt());
        detail.setUpdatedAt(f.getUpdatedAt());
        return detail;
    }
}
