package com.mbc.puf.member.service;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mbc.puf.common.enums.ManagerRole;
import com.mbc.puf.common.enums.ManagerStatus;
import com.mbc.puf.common.exception.BusinessException;
import com.mbc.puf.common.request.PageParams;
import com.mbc.puf.common.response.PageResponse;
import com.mbc.puf.common.util.SearchKeyword;
import com.mbc.puf.member.dao.ManagerAdminDao;
import com.mbc.puf.member.dto.ManagerListRow;
import com.mbc.puf.member.dto.ManagerSearchCondition;
import com.mbc.puf.member.dto.ManagerSummaryResponse;
import com.mbc.puf.region.dao.RegionDao;

@Service
public class ManagerAdminServiceImpl implements ManagerAdminService {

    private final ManagerAdminDao managerAdminDao;
    private final RegionDao regionDao;

    public ManagerAdminServiceImpl(ManagerAdminDao managerAdminDao, RegionDao regionDao) {
        this.managerAdminDao = managerAdminDao;
        this.regionDao = regionDao;
    }

    // ==================== 목록 ====================

    @Override
    @Transactional(readOnly = true)
    public PageResponse<ManagerSummaryResponse> getManagerList(String keyword, ManagerStatus status,
                                                               ManagerRole role, Long regionId,
                                                               boolean includeWithdrawn, int page, int size) {
        PageParams pageParams = PageParams.of(page, size);

        ManagerSearchCondition condition = new ManagerSearchCondition();
        SearchKeyword searchKeyword = SearchKeyword.of(keyword);
        if (searchKeyword != null) {
            condition.setKeyword(searchKeyword.getText());
            condition.setKeywordPhone(searchKeyword.getPhone());
        }
        condition.setStatus(status);
        condition.setRole(role);
        condition.setRegionId(regionId);
        condition.setIncludeWithdrawn(includeWithdrawn);
        condition.setSize(pageParams.getSize());
        condition.setOffset(pageParams.getOffset());

        long total = managerAdminDao.countManagerList(condition);
        List<ManagerSummaryResponse> items = (total == 0)
                ? List.of()
                : managerAdminDao.selectManagerList(condition).stream().map(this::toResponse).toList();
        return new PageResponse<>(items, pageParams.getPage(), pageParams.getSize(), total);
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<ManagerSummaryResponse> getPendingList(int page, int size) {
        PageParams pageParams = PageParams.of(page, size);

        long total = managerAdminDao.countPendingManagerList();
        List<ManagerSummaryResponse> items = (total == 0)
                ? List.of()
                : managerAdminDao.selectPendingManagerList(pageParams.getSize(), pageParams.getOffset())
                        .stream().map(this::toResponse).toList();
        return new PageResponse<>(items, pageParams.getPage(), pageParams.getSize(), total);
    }

    // ==================== 승인 / 거절 / 탈퇴 / 지역 변경 ====================

    @Override
    @Transactional
    public ManagerSummaryResponse approve(Long managerId, Long regionId, Long approverId) {
        ManagerListRow manager = requireManager(managerId);
        if (manager.getStatus() != ManagerStatus.PENDING) {
            throw new BusinessException(HttpStatus.CONFLICT, "이미 처리된 가입 신청입니다.");
        }
        requireActiveRegion(regionId);

        // WHERE 에 status = 'PENDING' 이 걸려 있어서, 그 사이 다른 관리자가 먼저 처리했다면 0이 돌아온다
        if (managerAdminDao.updateManagerApprove(managerId, regionId, approverId) == 0) {
            throw new BusinessException(HttpStatus.CONFLICT, "이미 처리된 가입 신청입니다.");
        }
        return toResponse(requireManager(managerId));
    }

    @Override
    @Transactional
    public ManagerSummaryResponse reject(Long managerId) {
        ManagerListRow manager = requireManager(managerId);
        if (manager.getStatus() != ManagerStatus.PENDING) {
            throw new BusinessException(HttpStatus.CONFLICT, "승인 대기 중인 가입 신청만 거절할 수 있습니다.");
        }
        if (managerAdminDao.updateManagerReject(managerId) == 0) {
            throw new BusinessException(HttpStatus.CONFLICT, "이미 처리된 가입 신청입니다.");
        }
        return toResponse(requireManager(managerId));
    }

    @Override
    @Transactional
    public ManagerSummaryResponse withdraw(Long managerId) {
        ManagerListRow manager = requireManager(managerId);

        // 마지막 최고관리자까지 잠겨버리는 일을 막기 위해 최고관리자 계정은 탈퇴 처리 대상에서 뺀다
        if (manager.getRole() == ManagerRole.SUPER_ADMIN) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "최고관리자 계정은 탈퇴 처리할 수 없습니다.");
        }
        if (manager.getStatus() == ManagerStatus.PENDING) {
            throw new BusinessException(HttpStatus.CONFLICT, "승인 대기 중인 계정은 거절 기능을 사용해주세요.");
        }
        if (manager.getStatus() == ManagerStatus.WITHDRAWN) {
            throw new BusinessException(HttpStatus.CONFLICT, "이미 탈퇴 처리된 계정입니다.");
        }
        if (managerAdminDao.updateManagerWithdraw(managerId) == 0) {
            throw new BusinessException(HttpStatus.CONFLICT, "계정 상태가 변경되었습니다. 다시 확인해주세요.");
        }
        return toResponse(requireManager(managerId));
    }

    @Override
    @Transactional
    public ManagerSummaryResponse reassignRegion(Long managerId, Long regionId) {
        ManagerListRow manager = requireManager(managerId);

        if (manager.getRole() != ManagerRole.REGIONAL_ADMIN) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "지역담당자만 담당 지역을 변경할 수 있습니다.");
        }
        if (manager.getStatus() == ManagerStatus.PENDING) {
            throw new BusinessException(HttpStatus.CONFLICT, "승인 대기 중인 계정은 승인할 때 담당 지역을 배정합니다.");
        }
        if (manager.getStatus() == ManagerStatus.WITHDRAWN) {
            throw new BusinessException(HttpStatus.CONFLICT, "탈퇴 처리된 계정입니다.");
        }
        requireActiveRegion(regionId);

        if (managerAdminDao.updateManagerRegion(managerId, regionId) == 0) {
            throw new BusinessException(HttpStatus.CONFLICT, "계정 상태가 변경되었습니다. 다시 확인해주세요.");
        }
        return toResponse(requireManager(managerId));
    }

    // ---- 내부 메서드 ----

    private ManagerListRow requireManager(Long managerId) {
        ManagerListRow manager = managerAdminDao.selectManagerRowById(managerId);
        if (manager == null) {
            throw new BusinessException(HttpStatus.NOT_FOUND, "존재하지 않는 관리자입니다.");
        }
        return manager;
    }

    // 삭제되지 않은 지역만 배정할 수 있다 ('미배정'도 삭제되지 않은 지역이라 선택 가능)
    private void requireActiveRegion(Long regionId) {
        if (regionDao.selectRegionById(regionId) == null) {
            throw new BusinessException(HttpStatus.NOT_FOUND, "존재하지 않는 지역입니다.");
        }
    }

    private ManagerSummaryResponse toResponse(ManagerListRow row) {
        return new ManagerSummaryResponse(row.getId(), row.getLoginId(), row.getName(), row.getEmail(),
                row.getPhone(), row.getRole(), row.getStatus(), row.getRegionId(), row.getRegionName(),
                row.getCreatedAt(), row.getApprovedAt());
    }
}
