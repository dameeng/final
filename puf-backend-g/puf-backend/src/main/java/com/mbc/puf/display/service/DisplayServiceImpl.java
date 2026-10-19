package com.mbc.puf.display.service;

import com.mbc.puf.common.enums.DisplayCategory;
import com.mbc.puf.common.exception.BusinessException;
import com.mbc.puf.common.jpa.DbClock;
import com.mbc.puf.common.security.LoginUser;
import com.mbc.puf.display.dto.DisplayPageItem;
import com.mbc.puf.display.dto.DisplayPageSaveRequest;
import com.mbc.puf.display.dto.DisplayPresetItem;
import com.mbc.puf.display.entity.DisplayHistory;
import com.mbc.puf.display.entity.DisplayPage;
import com.mbc.puf.display.entity.DisplayPreset;
import com.mbc.puf.display.repository.DisplayHistoryRepository;
import com.mbc.puf.display.repository.DisplayPageRepository;
import com.mbc.puf.display.repository.DisplayPresetRepository;
import java.util.List;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DisplayServiceImpl implements DisplayService {

    private final DisplayPresetRepository presetRepository;
    private final DisplayPageRepository pageRepository;
    private final DisplayHistoryRepository historyRepository;
    private final DbClock dbClock;

    public DisplayServiceImpl(
            DisplayPresetRepository presetRepository,
            DisplayPageRepository pageRepository,
            DisplayHistoryRepository historyRepository,
            DbClock dbClock) {
        this.presetRepository = presetRepository;
        this.pageRepository = pageRepository;
        this.historyRepository = historyRepository;
        this.dbClock = dbClock;
    }

    // ─── 프리셋 조회 ─────────────────────────────────────────────────

    @Override
    @Transactional(readOnly = true)
    public List<DisplayPresetItem> getPresets(DisplayCategory category) {
        List<DisplayPreset> presets = (category != null)
                ? presetRepository.findByCategory(category)
                : presetRepository.findAll();
        return presets.stream()
                .map(p -> new DisplayPresetItem(p.getId(), p.getCategory(), p.getContent()))
                .collect(Collectors.toList());
    }

    // ─── 페이지 목록 ─────────────────────────────────────────────────

    @Override
    @Transactional(readOnly = true)
    public List<DisplayPageItem> getPages(Long equipId) {
        return pageRepository.findByEquipIdOrderByPageNoAsc(equipId)
                .stream().map(this::toItem).collect(Collectors.toList());
    }

    // ─── 페이지 생성 ─────────────────────────────────────────────────

    @Override
    @Transactional
    public DisplayPageItem createPage(LoginUser loginUser, Long equipId, DisplayPageSaveRequest request) {
        int nextPageNo = pageRepository.findMaxPageNoByEquipId(equipId)
                .map(max -> max + 1)
                .orElse(1);

        DisplayPage page = new DisplayPage();
        page.setEquipId(equipId);
        page.setPageNo(nextPageNo);
        page.setContent(request.getContent().trim());
        page.setPresetId(request.getPresetId());
        page.setUpdatedBy(loginUser.id());
        page.setUpdatedAt(dbClock.now());
        pageRepository.save(page);

        // 최초 생성: oldContent = null
        saveHistory(page.getId(), null, null, page.getContent(), loginUser.id());

        return toItem(page);
    }

    // ─── 페이지 수정 ─────────────────────────────────────────────────

    @Override
    @Transactional
    public DisplayPageItem updatePage(LoginUser loginUser, Long equipId, Integer pageNo, DisplayPageSaveRequest request) {
        DisplayPage page = requirePage(equipId, pageNo);

        String newContent = request.getContent().trim();
        String oldContent = page.getContent();

        // 내용이 실제로 바뀔 때만 히스토리 저장
        if (!newContent.equals(oldContent)) {
            page.setContent(newContent);
            page.setPresetId(request.getPresetId());
            page.setUpdatedBy(loginUser.id());
            page.setUpdatedAt(dbClock.now());

            saveHistory(page.getId(), null, oldContent, newContent, loginUser.id());
        }

        return toItem(page);
    }

    // ─── 페이지 삭제 ─────────────────────────────────────────────────

    @Override
    @Transactional
    public void deletePage(LoginUser loginUser, Long equipId, Integer pageNo) {
        DisplayPage page = requirePage(equipId, pageNo);
        pageRepository.delete(page);
        // 삭제된 페이지 뒤에 있는 페이지들의 page_no 를 1씩 내린다
        pageRepository.shiftPageNoDown(equipId, pageNo);
    }

    // ─── 내부 헬퍼 ──────────────────────────────────────────────────

    private DisplayPage requirePage(Long equipId, Integer pageNo) {
        return pageRepository.findByEquipIdAndPageNo(equipId, pageNo)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND,
                        "전광판 페이지를 찾을 수 없습니다. equipId=" + equipId + ", pageNo=" + pageNo));
    }

    private void saveHistory(Long pageId, Long eventId, String oldContent, String newContent, Long changedBy) {
        DisplayHistory h = new DisplayHistory();
        h.setPageId(pageId);
        h.setEventId(eventId);
        h.setOldContent(oldContent);
        h.setNewContent(newContent);
        h.setChangedBy(changedBy);
        historyRepository.save(h);
    }

    private DisplayPageItem toItem(DisplayPage p) {
        DisplayPageItem item = new DisplayPageItem();
        item.setId(p.getId());
        item.setEquipId(p.getEquipId());
        item.setPageNo(p.getPageNo());
        item.setContent(p.getContent());
        item.setPresetId(p.getPresetId());
        item.setUpdatedBy(p.getUpdatedBy());
        item.setUpdatedAt(p.getUpdatedAt());
        return item;
    }
}
