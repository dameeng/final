package com.mbc.puf.alert.service;

import java.time.LocalDate;

import com.mbc.puf.alert.dto.AlertLogListItem;
import com.mbc.puf.alert.dto.MyAlertItem;
import com.mbc.puf.common.enums.AlertType;
import com.mbc.puf.common.response.PageResponse;

/** camera_role 감지를 계기로 한 개인화 알림 발송. 실제 푸시 연동은 없고 alert_log만 남긴다 */
public interface AlertService {

    // 사전예측(PREDICTIVE): APPROACH_LPR 카메라가 매칭했는데 그 지하차도 위험도가 WARNING/DANGER일 때, 그 차주에게 발송
    void sendPredictiveAlert(Long eventId, Long carId, String carNum);

    // 진입직전 최후확인(ROI_FINAL): ROI_LPR 카메라가 매칭했는데 그 지하차도가 지금 BLOCKED일 때, 그 차주에게 발송
    void sendRoiFinalAlert(Long eventId, Long carId, String carNum);

    // 알림 발송 이력 목록 (전부 선택 필터, 관리자용). startDate/endDate는 기간 필터(둘 다 선택),
    // keyword는 차량번호 포함검색(선택)
    PageResponse<AlertLogListItem> getAlertLogs(Long underpassId, Long customerId, AlertType alertType,
                                                 LocalDate startDate, LocalDate endDate, String keyword,
                                                 int page, int size);

    // 고객용 "내 알림" 목록 (문자처럼 보여주기용). customerId는 로그인한 본인으로 고정해서 넘긴다
    PageResponse<MyAlertItem> getMyAlerts(Long customerId, AlertType alertType, int page, int size);
}