package com.mbc.puf.pm.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.mbc.puf.pm.entity.PmLevel;
import com.mbc.puf.pm.entity.PmThreshold;

public interface PmThresholdRepository extends JpaRepository<PmThreshold, Long> {

    List<PmThreshold> findByEquipIdOrderByMinScoreAsc(Long equipId);

    Optional<PmThreshold> findByEquipIdAndLevel(Long equipId, PmLevel level);
}
