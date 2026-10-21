package com.mbc.puf.pm.entity;

/** 예지보전 점검 처리 상태 (DB: pm_event_status). 확인필요 → 점검중 → 조치완료/기타 순서로만 진행한다 */
public enum PmEventStatus {
    CHECK_NEEDED("확인 필요"),
    IN_PROGRESS("점검 중"),
    RESOLVED("조치 완료"),
    ETC("기타");

    private final String label;

    PmEventStatus(String label) {
        this.label = label;
    }

    public String getLabel() {
        return label;
    }

    public boolean isOpen() {
        return this == CHECK_NEEDED || this == IN_PROGRESS;
    }

    /** 지금 상태에서 next 로 바꿀 수 있는지 (뒤로 돌아가기, 끝난 건 다시 열기는 안 됨) */
    public boolean canMoveTo(PmEventStatus next) {
        return isOpen() && next.ordinal() > this.ordinal();
    }
}
