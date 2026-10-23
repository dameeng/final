package com.mbc.puf.pm.repository;

import com.mbc.puf.pm.entity.PmEquipment;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PmEquipmentRepository extends JpaRepository<PmEquipment, Long> {

    /** 설비 + 소속 지하차도 이름·지역 (삭제된 지하차도 제외) */
    interface EquipmentRow {
        Long getEquipId();
        String getType();
        Long getUnderpassId();
        String getUnderpassName();
        Long getRegionId();
    }

    // 예지보전 서버가 받아 갈 전체 설비 목록 (GET /api/internal/pm/equipments)
    @Query(value = """
        SELECT e.id AS equipId, CAST(e.type AS text) AS type, u.id AS underpassId, u.name AS underpassName,
               u.region_id AS regionId
        FROM pm_equipment e
        JOIN underpass u ON u.id = e.underpass_id
        WHERE u.is_deleted = FALSE
        ORDER BY e.id
        """, nativeQuery = true)
    List<EquipmentRow> findAllRows();

    // 점수를 받은 설비들만 (POST /api/internal/pm-scores 처리용)
    @Query(value = """
        SELECT e.id AS equipId, CAST(e.type AS text) AS type, u.id AS underpassId, u.name AS underpassName,
               u.region_id AS regionId
        FROM pm_equipment e
        JOIN underpass u ON u.id = e.underpass_id
        WHERE u.is_deleted = FALSE AND e.id IN (:ids)
        """, nativeQuery = true)
    List<EquipmentRow> findRowsByIds(@Param("ids") Collection<Long> ids);
}
