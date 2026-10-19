package com.mbc.puf.underpass.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.mbc.puf.common.enums.UnderpassEventType;
import com.mbc.puf.underpass.entity.UnderpassEvent;

public interface UnderpassEventRepository extends JpaRepository<UnderpassEvent, Long> {

    // 그 지하차도의 가장 최근 이벤트 (예: 가장 최근 RISK_LEVEL_UP — PREDICTIVE 알림의 계기 이벤트)
    Optional<UnderpassEvent> findFirstByUnderpassIdAndEventTypeOrderByCreatedAtDescIdDesc(Long underpassId,
                                                                                          UnderpassEventType eventType);
}
