package com.mbc.puf.internal.devstub;

import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.transaction.annotation.Transactional;

import com.mbc.puf.internal.entity.RiskScore;

/**
 * ⚠️ 임시(temp) 코드입니다.
 * FastAPI가 실제로 POST /api/internal/risk-scores 로 값을 주기적으로 밀어넣기 시작하면
 * {@link WeatherStubRiskScoreScheduler} 와 함께 com.mbc.puf.internal.devstub 패키지 전체를 삭제하면 됩니다.
 *
 * weather_hourly(날씨) 데이터를 기반으로 지하차도별 risk_score를 주기적으로 만들어 넣어서,
 * 프런트(underpass-map.vue 등)가 "갱신 지연" 없이 최신 위험도/강수량을 받아오는지
 * 테스트할 수 있게 해줍니다. 여기서 계산하는 risk_score는 실제 AI 모델이 아니라
 * 강수량에 비례한 더미(stub) 값입니다. (INSERT ... SELECT 한 방이라 네이티브 쿼리)
 */
public interface WeatherStubRiskScoreDao extends Repository<RiskScore, Long> {

    // 지하차도마다 가장 가까운 weather_area를 찾아 risk_score를 하나씩 새로 생성해 넣습니다.
    // 반환값은 insert된 행 수(대상 지하차도 수)입니다.
    @Transactional
    @Modifying
    @Query(value = """
            INSERT INTO risk_score (underpass_id, score, rain, rain_1h, rain_3h,
                                    rain_6h, rain_12h, rain_24h, predicted_at)
            SELECT
                u.id,
                LEAST(100, GREATEST(0, wh.rain * 3))::numeric(5,2),
                wh.rain,
                (SELECT COALESCE(SUM(w.rain), 0) FROM weather_hourly w
                   WHERE w.area_id = wh.area_id AND w.target_at > wh.target_at - INTERVAL '1 hour' AND w.target_at <= wh.target_at),
                (SELECT COALESCE(SUM(w.rain), 0) FROM weather_hourly w
                   WHERE w.area_id = wh.area_id AND w.target_at > wh.target_at - INTERVAL '3 hour' AND w.target_at <= wh.target_at),
                (SELECT COALESCE(SUM(w.rain), 0) FROM weather_hourly w
                   WHERE w.area_id = wh.area_id AND w.target_at > wh.target_at - INTERVAL '6 hour' AND w.target_at <= wh.target_at),
                (SELECT COALESCE(SUM(w.rain), 0) FROM weather_hourly w
                   WHERE w.area_id = wh.area_id AND w.target_at > wh.target_at - INTERVAL '12 hour' AND w.target_at <= wh.target_at),
                (SELECT COALESCE(SUM(w.rain), 0) FROM weather_hourly w
                   WHERE w.area_id = wh.area_id AND w.target_at > wh.target_at - INTERVAL '24 hour' AND w.target_at <= wh.target_at),
                NOW()
            FROM underpass u
            CROSS JOIN LATERAL (
                SELECT wa.id AS area_id
                FROM weather_area wa
                ORDER BY (wa.lat - u.lat) ^ 2 + (wa.lng - u.lng) ^ 2
                LIMIT 1
            ) nearest
            CROSS JOIN LATERAL (
                SELECT w.area_id, w.target_at, w.rain
                FROM weather_hourly w
                WHERE w.area_id = nearest.area_id
                ORDER BY ABS(EXTRACT(EPOCH FROM (w.target_at - NOW())))
                LIMIT 1
            ) wh
            WHERE u.is_deleted = FALSE
            """, nativeQuery = true)
    int insertStubRiskScores();
}
