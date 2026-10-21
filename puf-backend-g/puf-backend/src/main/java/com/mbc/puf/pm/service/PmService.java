package com.mbc.puf.pm.service;

import java.math.BigDecimal;
import java.util.List;

import com.mbc.puf.common.security.LoginUser;
import com.mbc.puf.pm.dto.PmActionCreateRequest;
import com.mbc.puf.pm.dto.PmActionItem;
import com.mbc.puf.pm.dto.PmEquipmentDetailResponse;
import com.mbc.puf.pm.dto.PmEquipmentItem;
import com.mbc.puf.pm.dto.PmEventItem;
import com.mbc.puf.pm.dto.PmRuleItem;
import com.mbc.puf.pm.dto.PmThresholdItem;
import com.mbc.puf.pm.dto.PmTrendResponse;
import com.mbc.puf.pm.entity.PmEquipmentType;
import com.mbc.puf.pm.entity.PmEventStatus;
import com.mbc.puf.pm.entity.PmLevel;

/** 예지보전(MP-20) 화면용 조회·처리. 조회는 담당 지역 범위, 처리는 담당 지역 설비만 */
public interface PmService {

    // 설비 목록 (점수 높은 순). type·level·regionId·underpassId 는 비우면 전체
    List<PmEquipmentItem> getEquipments(LoginUser loginUser, PmEquipmentType type, PmLevel level,
                                        Long regionId, Long underpassId);

    // 대시보드 '예지보전 Top5'
    List<PmEquipmentItem> getTop(LoginUser loginUser, int limit);

    PmEquipmentDetailResponse getDetail(LoginUser loginUser, Long equipId);

    PmTrendResponse getTrend(LoginUser loginUser, Long equipId, int days);

    // 점검 대상 목록. openOnly 면 확인필요·점검중만
    List<PmEventItem> getEvents(LoginUser loginUser, boolean openOnly, PmEquipmentType type);

    PmEventItem changeStatus(LoginUser loginUser, Long eventId, PmEventStatus status);

    PmActionItem addAction(LoginUser loginUser, Long eventId, PmActionCreateRequest request);

    // 점검 이력 (조치 기록, 최신순 최대 200건)
    List<PmActionItem> getActions(LoginUser loginUser, PmEquipmentType type, Long equipId);

    List<PmThresholdItem> getThresholds(LoginUser loginUser, Long equipId);

    PmThresholdItem updateThreshold(LoginUser loginUser, Long equipId, PmLevel level, BigDecimal minScore);

    List<PmRuleItem> getRules();
}
