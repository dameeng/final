package com.mbc.puf.board.service;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mbc.puf.board.dao.FaqDao;
import com.mbc.puf.board.dto.Faq;
import com.mbc.puf.board.dto.FaqCreateRequest;
import com.mbc.puf.board.dto.FaqDetailResponse;
import com.mbc.puf.board.dto.FaqListItem;
import com.mbc.puf.board.dto.FaqSearchCondition;
import com.mbc.puf.board.dto.FaqUpdateRequest;
import com.mbc.puf.common.exception.BusinessException;
import com.mbc.puf.common.request.PageParams;
import com.mbc.puf.common.response.PageResponse;
import com.mbc.puf.common.util.LikePattern;

@Service
public class FaqServiceImpl implements FaqService {

    private final FaqDao faqDao;

    public FaqServiceImpl(FaqDao faqDao) {
        this.faqDao = faqDao;
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<FaqListItem> getFaqList(String keyword, int page, int size) {
        PageParams pageParams = PageParams.of(page, size);

        FaqSearchCondition condition = new FaqSearchCondition();
        condition.setKeyword(LikePattern.of(keyword));
        condition.setSize(pageParams.getSize());
        condition.setOffset(pageParams.getOffset());

        long total = faqDao.countFaqList(condition);
        List<FaqListItem> items = (total == 0) ? List.of() : faqDao.selectFaqList(condition);

        return new PageResponse<>(items, pageParams.getPage(), pageParams.getSize(), total);
    }

    @Override
    @Transactional(readOnly = true)
    public FaqDetailResponse getFaq(Long id) {
        return getActiveFaq(id);
    }

    @Override
    @Transactional
    public FaqDetailResponse createFaq(Long authorId, FaqCreateRequest request) {
        Faq faq = new Faq();
        faq.setQuestion(request.getQuestion().trim());
        faq.setAnswer(request.getAnswer());
        faq.setAuthorId(authorId);

        faqDao.insertFaq(faq);   // 생성된 id가 faq.id 에 채워진다

        return getActiveFaq(faq.getId());
    }

    @Override
    @Transactional
    public FaqDetailResponse updateFaq(Long id, FaqUpdateRequest request) {
        getActiveFaq(id);   // 존재/삭제 여부 확인, 없으면 404

        Faq faq = new Faq();
        faq.setId(id);
        faq.setQuestion(request.getQuestion().trim());
        faq.setAnswer(request.getAnswer());

        faqDao.updateFaq(faq);

        return getActiveFaq(id);
    }

    @Override
    @Transactional
    public void deleteFaq(Long id) {
        if (faqDao.softDeleteFaq(id) == 0) {
            throw new BusinessException(HttpStatus.NOT_FOUND, "존재하지 않는 FAQ입니다. id=" + id);
        }
    }

    private FaqDetailResponse getActiveFaq(Long id) {
        FaqDetailResponse faq = faqDao.selectFaqById(id);
        if (faq == null) {
            throw new BusinessException(HttpStatus.NOT_FOUND, "존재하지 않는 FAQ입니다. id=" + id);
        }
        return faq;
    }
}
