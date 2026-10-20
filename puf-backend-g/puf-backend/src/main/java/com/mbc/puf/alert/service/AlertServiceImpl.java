package com.mbc.puf.alert.service;

import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mbc.puf.alert.dto.AlertLogListItem;
import com.mbc.puf.alert.dto.MyAlertItem;
import com.mbc.puf.alert.entity.Alert;
import com.mbc.puf.alert.entity.AlertDelivery;
import com.mbc.puf.alert.repository.AlertDeliveryRepository;
import com.mbc.puf.alert.repository.AlertRepository;
import com.mbc.puf.car.entity.Car;
import com.mbc.puf.car.repository.CarRepository;
import com.mbc.puf.common.enums.AlertChannel;
import com.mbc.puf.common.enums.AlertType;
import com.mbc.puf.common.enums.DeliveryStatus;
import com.mbc.puf.common.query.PagedQuery;
import com.mbc.puf.common.query.QueryConditions;
import com.mbc.puf.common.request.PageQuery;
import com.mbc.puf.common.request.PeriodQuery;
import com.mbc.puf.common.request.ScopeQuery;
import com.mbc.puf.common.request.VehicleQuery;
import com.mbc.puf.common.response.PageResponse;
import com.mbc.puf.common.security.LoginUser;
import com.mbc.puf.common.security.ScopeResolver;
import com.mbc.puf.notification.service.NotificationService;

import jakarta.persistence.EntityManager;

@Service
public class AlertServiceImpl implements AlertService {

    private static final Logger log = LoggerFactory.getLogger(AlertServiceImpl.class);

    // 관리자 목록: 계기 이벤트(지하차도) + 지역 범위 조건을 위해 underpass 까지 조인
    private static final String ADMIN_FROM = " from Alert a join UnderpassEvent ue on ue.id = a.eventId"
            + " join Underpass u on u.id = ue.underpassId";

    // 고객 "내 알림": 지하차도 이름 + 수신 전화번호까지
    private static final String MY_FROM = ADMIN_FROM + " join Customer c on c.id = a.customerId";

    private final AlertRepository alertRepository;
    private final AlertDeliveryRepository deliveryRepository;
    private final CarRepository carRepository;
    private final ScopeResolver scopeResolver;
    private final NotificationService notificationService;   // 고객 알림 센터(위험 분류)에도 남긴다
    private final EntityManager em;

    public AlertServiceImpl(AlertRepository alertRepository, AlertDeliveryRepository deliveryRepository,
                            CarRepository carRepository, ScopeResolver scopeResolver,
                            NotificationService notificationService, EntityManager em) {
        this.alertRepository = alertRepository;
        this.deliveryRepository = deliveryRepository;
        this.carRepository = carRepository;
        this.scopeResolver = scopeResolver;
        this.notificationService = notificationService;
        this.em = em;
    }

    @Override
    @Transactional
    public void sendPredictiveAlert(Long eventId, Long carId, String carNum) {
        carRepository.findById(carId)
                .ifPresent(car -> insert(eventId, car.getCustomerId(), carId, carNum, AlertType.PREDICTIVE));
    }

    @Override
    @Transactional
    public void sendRoiFinalAlert(Long eventId, Long carId, String carNum) {
        carRepository.findById(carId)
                .ifPresent(car -> insert(eventId, car.getCustomerId(), carId, carNum, AlertType.FINAL));
    }

    private void insert(Long eventId, Long customerId, Long carId, String carNum, AlertType alertType) {
        Alert alert = new Alert();
        alert.setEventId(eventId);
        alert.setCustomerId(customerId);
        alert.setCarId(carId);
        alert.setCarNum(carNum);
        alert.setAlertType(alertType);
        alertRepository.saveAndFlush(alert);  // flush → id 확보

        // alert_delivery 채널 기록 (SMS: 실제 연동 전까지 PENDING)
        insertDelivery(alert.getId(), AlertChannel.SMS, null, DeliveryStatus.PENDING);

        // 고객 알림 센터(위험 분류): 계기 이벤트의 지하차도 이름과 함께 한 건 남긴다
        List<String> names = em.createQuery("select u.name from UnderpassEvent ue join Underpass u"
                        + " on u.id = ue.underpassId where ue.id = :id", String.class)
                .setParameter("id", eventId).getResultList();
        notificationService.notifyCustomerRisk(customerId, alert.getId(), names.isEmpty() ? null : names.get(0),
                carNum, alertType);

        // 실제 문자 발송 연동 전까지: 긴급재난문자 형식으로 보냈다고 치고 콘솔에 남긴다
        // (회원가입 없이도 번호판 매칭만으로 수신 가능하다는 컨셉이라 "앱 푸시"가 아니라 "문자"로 표기)
        log.info("\n===== [긴급재난문자 발송!!!] =====\n대상 고객ID: {}\n차량번호: {}\n" +
                "알림종류: {}\n계기 이벤트ID: {}\n==========================", customerId, carNum,
                alertType, eventId);
    }

    private void insertDelivery(Long alertId, AlertChannel channel, Long tokenId, DeliveryStatus status) {
        AlertDelivery d = new AlertDelivery();
        d.setAlertId(alertId);
        d.setChannel(channel);
        d.setTokenId(tokenId);   // SMS면 null
        d.setStatus(status);
        deliveryRepository.save(d);
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<AlertLogListItem> getAlertLogs(LoginUser loginUser, ScopeQuery scope, Long customerId,
                                                       AlertType alertType, VehicleQuery vehicle,
                                                       PeriodQuery period, PageQuery page) {
        // REGIONAL_ADMIN은 본인 담당 지역 시설에서 나간 알림만 (Scope 공통 규칙)
        ScopeQuery resolved = scopeResolver.resolve(loginUser, scope);
        QueryConditions c = new QueryConditions()
                .eqIfPresent("ue.underpassId", resolved.getUnderpassId())
                .inIfPresent("u.regionId", resolved.getRegionIds())
                .eqIfPresent("a.customerId", customerId)
                .eqIfPresent("a.alertType", alertType)
                .carNumIfPresent(vehicle.getCarNum(), "a.carNum")
                .periodIfPresent("a.sentAt", period);

        return PagedQuery.fetch(em, "select a, ue.underpassId" + ADMIN_FROM, "select count(a)" + ADMIN_FROM, c,
                " order by a.sentAt desc, a.id desc", Object[].class, row -> {
                    Alert a = (Alert) row[0];
                    return new AlertLogListItem(a.getId(), a.getEventId(), (Long) row[1], a.getCustomerId(),
                            a.getCarId(), a.getCarNum(), a.getAlertType(), a.getSentAt());
                }, page.toParams());
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<MyAlertItem> getMyAlerts(Long customerId, AlertType alertType, PeriodQuery period,
                                                 PageQuery page) {
        QueryConditions c = new QueryConditions()
                .add("a.customerId = ?", customerId)   // 본인 것만
                .eqIfPresent("a.alertType", alertType)
                .periodIfPresent("a.sentAt", period);

        return PagedQuery.fetch(em, "select a, u.name, c.phone" + MY_FROM, "select count(a)" + MY_FROM, c,
                " order by a.sentAt desc, a.id desc", Object[].class, row -> {
                    Alert a = (Alert) row[0];
                    return new MyAlertItem(a.getId(), (String) row[1], a.getCarNum(), (String) row[2],
                            a.getAlertType(), a.getSentAt());
                }, page.toParams());
    }
}