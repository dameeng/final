package com.mbc.puf.pm.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.mbc.puf.pm.entity.PmSensor;

public interface PmSensorRepository extends JpaRepository<PmSensor, Long> {
}
