package com.mbc.puf.alert.service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mbc.puf.alert.dao.AlertDao;
import com.mbc.puf.alert.dto.AlertLog;
import com.mbc.puf.alert.dto.AlertLogListItem;
import com.mbc.puf.alert.dto.MyAlertItem;
import com.mbc.puf.car.dao.CarDao;
import com.mbc.puf.car.dto.Car;
import com.mbc.puf.common.enums.AlertType;
import com.mbc.puf.common.request.PageParams;
import com.mbc.puf.common.response.PageResponse;
import com.mbc.puf.common.util.LikePattern;

@Service
public class AlertServiceImpl implements AlertService {

    private static final Logger log = LoggerFactory.getLogger(AlertServiceImpl.class);

    private final AlertDao alertDao;
    private final CarDao carDao;

    public AlertServiceImpl(AlertDao alertDao, CarDao carDao) {
        this.alertDao = alertDao;
        this.carDao = carDao;
    }

    @Override
    @Transactional
    public void sendPredictiveAlert(Long eventId, Long carId, String carNum) {
        Car car = carDao.selectCarById(carId);
        if (car != null) {
            insert(eventId, car.getCustomerId(), carId, carNum, AlertType.PREDICTIVE);
        }
    }

    @Override
    @Transactional
    public void sendRoiFinalAlert(Long eventId, Long carId, String carNum) {
        Car car = carDao.selectCarById(carId);
        if (car != null) {
            insert(eventId, car.getCustomerId(), carId, carNum, AlertType.ROI_FINAL);
        }
    }

    private void insert(Long eventId, Long customerId, Long carId, String carNum, AlertType alertType) {
        AlertLog alertLog = new AlertLog();
        alertLog.setEventId(eventId);
        alertLog.setCustomerId(customerId);
        alertLog.setCarId(carId);
        alertLog.setCarNum(carNum);
        alertLog.setAlertType(alertType);
        alertDao.insertAlertLog(alertLog);

        // 실제 문자 발송 연동 전까지: 긴급재난문자 형식으로 보냈다고 치고 콘솔에 남긴다
        // (회원가입 없이도 번호판 매칭만으로 수신 가능하다는 컨셉이라 "앱 푸시"가 아니라 "문자"로 표기)
		
		 log.info("\n===== [긴급재난문자 발송] =====\n대상 고객ID: {}\n차량번호: {}\n" +
		 "알림종류: {}\n계기 이벤트ID: {}\n==========================", customerId, carNum,
		 alertType, eventId);
		 
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<AlertLogListItem> getAlertLogs(Long underpassId, Long customerId, AlertType alertType,
                                                        LocalDate startDate, LocalDate endDate, String keyword,
                                                        int page, int size) {
        PageParams pageParams = PageParams.of(page, size);

        // endDate는 "그날까지 포함"이 되도록 다음날 00:00을 배타적 상한으로 사용
        LocalDateTime startAt = (startDate == null) ? null : startDate.atStartOfDay();
        LocalDateTime endAt = (endDate == null) ? null : endDate.plusDays(1).atStartOfDay();
        LikePattern pattern = LikePattern.ofCar(keyword);
        String carNumPattern = (pattern == null) ? null : pattern.getContains();

        long total = alertDao.countAlertLogs(underpassId, customerId, alertType, startAt, endAt, carNumPattern);
        List<AlertLogListItem> items = (total == 0) ? List.of()
                : alertDao.selectAlertLogs(underpassId, customerId, alertType, startAt, endAt, carNumPattern,
                        pageParams.getSize(), pageParams.getOffset());

        return new PageResponse<>(items, pageParams.getPage(), pageParams.getSize(), total);
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<MyAlertItem> getMyAlerts(Long customerId, AlertType alertType, int page, int size) {
        PageParams pageParams = PageParams.of(page, size);

        long total = alertDao.countMyAlerts(customerId, alertType);
        List<MyAlertItem> items = (total == 0) ? List.of()
                : alertDao.selectMyAlerts(customerId, alertType, pageParams.getSize(), pageParams.getOffset());

        return new PageResponse<>(items, pageParams.getPage(), pageParams.getSize(), total);
    }
}