package com.mbc.puf.pm.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * 1분마다 점수 없는 측정값을 계산한다 (puf.pm.scoring.enabled=false 로 끌 수 있음, 기본은 켜짐).
 * 서버를 켜면 10초 뒤 첫 실행 → puf_05 더미 측정값의 점수·점검 대상이 이때 한꺼번에 만들어진다.
 */
@Component
@ConditionalOnProperty(name = "puf.pm.scoring.enabled", havingValue = "true", matchIfMissing = true)
public class PmScoreScheduler {

    private static final Logger log = LoggerFactory.getLogger(PmScoreScheduler.class);

    private final PmScoringService scoringService;

    public PmScoreScheduler(PmScoringService scoringService) {
        this.scoringService = scoringService;
    }

    @Scheduled(initialDelay = 10_000, fixedDelay = 60_000)
    public void run() {
        try {
            int count = scoringService.scoreUnscored();
            if (count > 0) {
                log.info("[예지보전] 점수 {}건 계산", count);
            }
        } catch (Exception e) {
            log.warn("[예지보전] 점수 계산 실패: {}", e.getMessage());
        }
    }
}
