package com.mbc.puf.plate.repository;

import java.time.LocalDateTime;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.mbc.puf.plate.entity.PlateLog;

public interface PlateLogRepository extends JpaRepository<PlateLog, Long> {

    // 판별대기(PENDING) 중 마감(review_due)이 지난 건을 AUTO_PROCESSED로 일괄 처리 (스케줄러 전용)
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update PlateLog p set p.reviewStatus = com.mbc.puf.common.enums.ReviewStatus.AUTO_PROCESSED, p.reviewedAt = :now"
            + " where p.reviewStatus = com.mbc.puf.common.enums.ReviewStatus.PENDING and p.reviewDeadline < :now")
    int autoProcessExpired(@Param("now") LocalDateTime now);
}
