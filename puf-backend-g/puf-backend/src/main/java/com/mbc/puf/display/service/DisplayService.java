package com.mbc.puf.display.service;

import com.mbc.puf.common.enums.DisplayCategory;
import com.mbc.puf.common.security.LoginUser;
import com.mbc.puf.display.dto.DisplayPageItem;
import com.mbc.puf.display.dto.DisplayPageSaveRequest;
import com.mbc.puf.display.dto.DisplayPresetItem;
import java.util.List;

public interface DisplayService {

    /** 특정 카테고리(또는 전체)의 전광판 프리셋 목록 */
    List<DisplayPresetItem> getPresets(DisplayCategory category);

    /** 특정 전광판(equip_id) 의 페이지 목록 (page_no 오름차순) */
    List<DisplayPageItem> getPages(Long equipId);

    /**
     * 페이지 신규 생성 (해당 equip_id 에서 max(page_no)+1 자동 부여).
     * 문구 변경이므로 display_history 행 삽입.
     */
    DisplayPageItem createPage(LoginUser loginUser, Long equipId, DisplayPageSaveRequest request);

    /**
     * 페이지 수정 (내용 변경 시에만 display_history 삽입).
     * pageNo 기준으로 조회.
     */
    DisplayPageItem updatePage(LoginUser loginUser, Long equipId, Integer pageNo, DisplayPageSaveRequest request);

    /**
     * 페이지 삭제 (이후 page_no 재정렬).
     */
    void deletePage(LoginUser loginUser, Long equipId, Integer pageNo);
}
