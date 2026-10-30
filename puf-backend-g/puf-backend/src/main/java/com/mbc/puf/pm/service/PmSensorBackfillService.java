package com.mbc.puf.pm.service;

import java.time.LocalDateTime;
import java.util.List;

import com.mbc.puf.pm.dto.PmSensorBackfillResponse;

/**
 * 센서 과거 데이터 채우기 (시연·개발용). 예지보전 설비마다 endAt 에서 weeks 주 전부터 센서 주기대로 값을 만든다.
 * 과거 데이터는 전부 정상 값이다 (이상은 DANGER 모드를 켠 설비에만, 켠 시점부터 실시간 stub 이 넣는다).
 * normalWeeks 는 API 모양을 바꾸지 않으려고 남겨 두었고 만드는 값에는 영향이 없다.
 */
public interface PmSensorBackfillService {

    /**
     * @param weeks       전체 주 수 (null 이면 설정 puf.pm.backfill.weeks, 기본 14)
     * @param normalWeeks 정상만 있는 앞 주 수 (null 이면 설정, 기본 4)
     * @param endAt       마지막 시각 (null 이면 지금). 센서 주기에 맞춰 내림
     * @param reset       true 면 대상 설비의 센서 데이터를 지우고 다시 만든다. false 면 센서 데이터가 이미 있는 설비는 건너뛴다
     * @param equipIds    대상 설비 (null 이면 삭제되지 않은 전체)
     */
    PmSensorBackfillResponse backfill(Integer weeks, Integer normalWeeks, LocalDateTime endAt, boolean reset, List<Long> equipIds);
    /** 최신 센서를 장비당 maxSamples개까지 추가. 기존 데이터는 수정하지 않는다. */
    int appendRecent(int maxSamples);
}

