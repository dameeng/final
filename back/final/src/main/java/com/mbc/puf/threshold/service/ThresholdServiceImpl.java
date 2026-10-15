package com.mbc.puf.threshold.service;

import java.math.BigDecimal;
import java.util.List;
import java.util.stream.Collectors;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mbc.puf.common.enums.RiskLevel;
import com.mbc.puf.common.exception.BusinessException;
import com.mbc.puf.common.security.LoginUser;
import com.mbc.puf.threshold.dao.ThresholdDao;
import com.mbc.puf.threshold.dto.Threshold;
import com.mbc.puf.threshold.dto.ThresholdHistory;
import com.mbc.puf.threshold.dto.ThresholdResponse;
import com.mbc.puf.threshold.dto.ThresholdUpdateRequest;
import com.mbc.puf.underpass.dao.UnderpassDao;
import com.mbc.puf.underpass.dto.UnderpassDetailResponse;

@Service
public class ThresholdServiceImpl implements ThresholdService {

    private static final String REGIONAL_ADMIN = "REGIONAL_ADMIN";

    private final ThresholdDao thresholdDao;
    private final UnderpassDao underpassDao;

    public ThresholdServiceImpl(ThresholdDao thresholdDao, UnderpassDao underpassDao) {
        this.thresholdDao = thresholdDao;
        this.underpassDao = underpassDao;
    }

    @Override
    @Transactional(readOnly = true)
    public List<ThresholdResponse> getThresholds(LoginUser loginUser, Long underpassId) {
        requireExistingUnderpass(underpassId);   // 지역 제한 없이 존재만 확인 (조회는 관리자 모두 허용)
        return thresholdDao.selectThresholdsByUnderpassId(underpassId).stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public ThresholdResponse updateThreshold(LoginUser loginUser, Long underpassId, RiskLevel level,
                                              ThresholdUpdateRequest request) {
        UnderpassDetailResponse underpass = requireExistingUnderpass(underpassId);
        requireOwnableRegion(loginUser, underpass.getRegionId());   // REGIONAL_ADMIN은 본인 담당 지역만

        Threshold current = thresholdDao.selectThreshold(underpassId, level);
        if (current == null) {
            throw new BusinessException(HttpStatus.NOT_FOUND, "존재하지 않는 임계치입니다. underpassId=" + underpassId
                    + ", level=" + level);
        }

        thresholdDao.updateThresholdValue(underpassId, level, request.getRiskScoreMin(), loginUser.id());
        recordHistory(current.getId(), current.getRiskScoreMin(), request.getRiskScoreMin(), loginUser.id());

        return toResponse(thresholdDao.selectThreshold(underpassId, level));
    }

    // 지하차도 등록 시 UnderpassServiceImpl이 호출해서 기본 임계치 3행을 만드는 용도.
    // 여기서도 이력을 남긴다(최초 생성분도 threshold_history에 기록하기로 했으므로 old값은 null)
    @Override
    @Transactional
    public void createDefaultThresholds(Long underpassId, Long createdBy) {
        // AI 모델의 표시점수 경계(0/40/70)를 기본값으로 사용. 지하차도별로 관리자가 이후 조정 가능
        insertOne(underpassId, RiskLevel.SAFE, new BigDecimal("0.00"), createdBy);
        insertOne(underpassId, RiskLevel.WARNING, new BigDecimal("40.00"), createdBy);
        insertOne(underpassId, RiskLevel.DANGER, new BigDecimal("70.00"), createdBy);
    }

    private void insertOne(Long underpassId, RiskLevel level, BigDecimal riskScoreMin, Long createdBy) {
        Threshold threshold = new Threshold();
        threshold.setUnderpassId(underpassId);
        threshold.setLevel(level);
        threshold.setRiskScoreMin(riskScoreMin);
        threshold.setUpdatedBy(createdBy);

        thresholdDao.insertThreshold(threshold);   // 생성된 id가 threshold.id 에 채워진다

        recordHistory(threshold.getId(), null, riskScoreMin, createdBy);
    }

    // ---- 내부 메서드 ----

    // 삭제되지 않은 지하차도 상세 조회, 없으면 404. 반환값의 regionId를 REGIONAL_ADMIN 권한 체크에 재사용한다
    private UnderpassDetailResponse requireExistingUnderpass(Long underpassId) {
        UnderpassDetailResponse underpass = underpassDao.selectUnderpassById(underpassId);
        if (underpass == null) {
            throw new BusinessException(HttpStatus.NOT_FOUND, "존재하지 않는 지하차도입니다. id=" + underpassId);
        }
        return underpass;
    }

    // REGIONAL_ADMIN이 자기 담당 지역이 아닌 지하차도의 임계치를 조정하려 하면 차단
    private void requireOwnableRegion(LoginUser loginUser, Long regionId) {
        if (REGIONAL_ADMIN.equals(loginUser.role()) && !loginUser.regionId().equals(regionId)) {
            throw new BusinessException(HttpStatus.FORBIDDEN, "담당 지역 외 지하차도의 임계치는 조정할 수 없습니다.");
        }
    }

    private void recordHistory(Long thresholdId, BigDecimal oldValue, BigDecimal newValue,
                                Long changedBy) {
        ThresholdHistory history = new ThresholdHistory();
        history.setThresholdId(thresholdId);
        history.setOldRiskScoreMin(oldValue);
        history.setNewRiskScoreMin(newValue);
        history.setChangedBy(changedBy);
        thresholdDao.insertThresholdHistory(history);
    }

    private ThresholdResponse toResponse(Threshold threshold) {
        return new ThresholdResponse(threshold.getId(), threshold.getUnderpassId(), threshold.getLevel(),
                threshold.getRiskScoreMin(), threshold.getUpdatedBy(), threshold.getUpdatedAt());
    }
}