package com.mbc.puf.display.repository;

import com.mbc.puf.display.entity.DisplayPage;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface DisplayPageRepository extends JpaRepository<DisplayPage, Long> {

    /** 특정 전광판 설비의 전체 페이지 (페이지 번호 오름차순) */
    List<DisplayPage> findByEquipIdOrderByPageNoAsc(Long equipId);

    /** 특정 전광판의 특정 페이지 번호 */
    Optional<DisplayPage> findByEquipIdAndPageNo(Long equipId, Integer pageNo);

    /** 특정 전광판의 최대 페이지 번호 (페이지가 없으면 Optional.empty) */
    @Query("select max(dp.pageNo) from DisplayPage dp where dp.equipId = :equipId")
    Optional<Integer> findMaxPageNoByEquipId(@Param("equipId") Long equipId);

    /** 특정 전광판의 pageNo > targetPageNo 인 페이지를 모두 1씩 내린다 (삭제 후 재정렬용) */
    @Modifying
    @Query("update DisplayPage dp set dp.pageNo = dp.pageNo - 1 where dp.equipId = :equipId and dp.pageNo > :deletedPageNo")
    int shiftPageNoDown(@Param("equipId") Long equipId, @Param("deletedPageNo") Integer deletedPageNo);
}
