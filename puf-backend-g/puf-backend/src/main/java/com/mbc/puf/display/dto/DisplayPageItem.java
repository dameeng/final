package com.mbc.puf.display.dto;

import java.time.LocalDateTime;

/** 전광판 페이지 목록 아이템 */
public class DisplayPageItem {
    private Long id;
    private Long equipId;
    private Integer pageNo;
    private String content;
    private Long presetId;
    private Long updatedBy;
    private LocalDateTime updatedAt;

    public DisplayPageItem() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getEquipId() { return equipId; }
    public void setEquipId(Long equipId) { this.equipId = equipId; }

    public Integer getPageNo() { return pageNo; }
    public void setPageNo(Integer pageNo) { this.pageNo = pageNo; }

    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }

    public Long getPresetId() { return presetId; }
    public void setPresetId(Long presetId) { this.presetId = presetId; }

    public Long getUpdatedBy() { return updatedBy; }
    public void setUpdatedBy(Long updatedBy) { this.updatedBy = updatedBy; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
