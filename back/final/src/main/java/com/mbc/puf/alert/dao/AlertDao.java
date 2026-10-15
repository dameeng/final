package com.mbc.puf.alert.dao;

import java.time.LocalDateTime;
import java.util.List;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import com.mbc.puf.alert.dto.AlertLog;
import com.mbc.puf.alert.dto.AlertLogListItem;
import com.mbc.puf.alert.dto.MyAlertItem;
import com.mbc.puf.common.enums.AlertType;

@Mapper
public interface AlertDao {

    // 알림 발송 기록. 생성된 id가 alertLog.id 에 채워진다
    int insertAlertLog(AlertLog alertLog);

    // 목록 조회 (전부 선택 필터). underpassId는 underpass_event 조인으로 확인.
    // startAt/endAt은 sent_at 기준 기간 필터(둘 다 선택), carNumPattern은 차량번호 포함검색용 ILIKE 패턴(선택)
    List<AlertLogListItem> selectAlertLogs(@Param("underpassId") Long underpassId,
                                            @Param("customerId") Long customerId,
                                            @Param("alertType") AlertType alertType,
                                            @Param("startAt") LocalDateTime startAt,
                                            @Param("endAt") LocalDateTime endAt,
                                            @Param("carNumPattern") String carNumPattern,
                                            @Param("size") int size, @Param("offset") long offset);

    long countAlertLogs(@Param("underpassId") Long underpassId, @Param("customerId") Long customerId,
                         @Param("alertType") AlertType alertType,
                         @Param("startAt") LocalDateTime startAt, @Param("endAt") LocalDateTime endAt,
                         @Param("carNumPattern") String carNumPattern);

    // 고객용 "내 알림" 목록 (문자처럼 보여주기용). 지하차도 이름까지 조인해서 가져온다
    List<MyAlertItem> selectMyAlerts(@Param("customerId") Long customerId, @Param("alertType") AlertType alertType,
                                      @Param("size") int size, @Param("offset") long offset);

    long countMyAlerts(@Param("customerId") Long customerId, @Param("alertType") AlertType alertType);
}