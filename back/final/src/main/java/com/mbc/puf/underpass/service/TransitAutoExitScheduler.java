package com.mbc.puf.underpass.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * 잔류(REMAINING)/장시간 IN_TRANSIT 상태로 남아 출구 인식이 영영 안 잡히는 통과 기록
 * (방치 차량, 인식 실패 등)을 주기적으로 훑어서, entry_at 기준 일정 시간(현재 2분,
 * UnderpassServiceImpl.AUTO_EXIT_MINUTES)이 지나면 자동으로 "통과완료(EXITED)"로 정리한다.
 *
 * 실제 출구 카메라 매칭이 있었던 게 아니므로 exit_plate_log_id는 비워두고 exit_at만 처리
 * 시각으로 채운다 (UnderpassTransitMapper.xml의 expireStaleTransits 참고).
 *
 * FinalApplication에 이미 @EnableScheduling이 있어 추가 설정은 필요 없다.
 */
@Component
public class TransitAutoExitScheduler {

    private static final Logger log = LoggerFactory.getLogger(TransitAutoExitScheduler.class);

    private final UnderpassService underpassService;

    public TransitAutoExitScheduler(UnderpassService underpassService) {
        this.underpassService = underpassService;
    }

    // 임계값(2분)보다 짧은 주기로 돌아야 처리가 지연되지 않는다
    @Scheduled(fixedRate = 30_000)
    public void run() {
        int count = underpassService.expireStaleTransits();
        if (count > 0) {
            log.info("잔류/장시간 통과 기록 {}건을 자동 통과완료 처리했습니다.", count);
        }
    }
}
