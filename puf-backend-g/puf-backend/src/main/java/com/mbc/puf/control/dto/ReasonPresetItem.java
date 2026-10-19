package com.mbc.puf.control.dto;

/** 차단/해제 사유 프리셋 목록 아이템 */
public class ReasonPresetItem {
    private Long id;
    private String content;

    public ReasonPresetItem(Long id, String content) {
        this.id = id;
        this.content = content;
    }

    public Long getId() { return id; }
    public String getContent() { return content; }
}
