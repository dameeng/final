package com.mbc.puf.pm.repository;

import java.util.Collection;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.mbc.puf.pm.entity.PmEvent;
import com.mbc.puf.pm.entity.PmEventStatus;

public interface PmEventRepository extends JpaRepository<PmEvent, Long> {

    // 아직 끝나지 않은(확인필요·점검중) 점검 대상. 설비당 하나만 열어 둔다
    Optional<PmEvent> findFirstByEquipIdAndStatusInOrderByCreatedAtDesc(Long equipId, Collection<PmEventStatus> statuses);
}
