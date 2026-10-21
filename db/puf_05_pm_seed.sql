-- =====================================================================
-- puf_05_pm_seed.sql — 예지보전(배수펌프·CCTV·전광판) 시연용 더미 데이터
--
-- 실행 순서: 팀 DDL(puf_db_schema_v4.sql) → 팀 seed(seed_all.sql) → (puf_03, puf_04) → 이 파일
-- 다시 실행해도 된다 (pm 측정값·점수·점검·조치를 지우고 새로 넣음. 설비·기준은 건드리지 않음)
--
-- 넣는 것
--   1) pm_event 에 reason(사유) 컬럼 추가  ← 팀 DDL 에도 같은 줄을 넣어 달라고 할 것
--   2) pm_sensor: 설비 135대 × 최근 7일(6시간 간격, 29번) 측정값
--        대부분 정상(점수 3~25점). 아래 4대만 점점 나빠짐
--          13 초량 제1지하차도 배수펌프 → 82점(위험)   14 초량 제2지하차도 CCTV → 61점(주의)
--          22 범천지하차도     배수펌프 → 48점(주의)   18 우장춘 지하차도 전광판 → 55점(주의)
--   3) 지난 점검 이력 4건 (pm_event 조치완료/기타 + pm_action)
--   점수(pm_score)와 지금 열린 점검 대상은 스프링이 켜지고 10초 뒤 PmScoreScheduler 가 계산해서 만든다.
--   측정 항목 이름·기준값은 스프링 PmRules.java 와 같아야 한다.
-- =====================================================================

-- 시각은 한국 시간 기준 (스프링도 Asia/Seoul 로 접속함)
SET TIME ZONE 'Asia/Seoul';

-- 1) 사유 컬럼
ALTER TABLE pm_event ADD COLUMN IF NOT EXISTS reason VARCHAR(255); -- 사유: 점수를 올린 항목 요약

-- 다시 실행할 때를 위해 비우기 (순서: 조치 → 점검 → 점수 → 측정값)
DELETE FROM pm_action;
DELETE FROM pm_event;
DELETE FROM pm_score;
DELETE FROM pm_sensor;

-- 2) 측정값
WITH rule(type, metric, rank, lim, is_count) AS (VALUES
    ('PUMP',    'motor_current_rise',    1, 20, FALSE),
    ('PUMP',    'start_error_count',     2,  5, TRUE),
    ('PUMP',    'drain_response_delay',  3, 30, FALSE),
    ('PUMP',    'vibration_index',       4,  7, FALSE),
    ('PUMP',    'no_data_minutes',       5, 10, TRUE),
    ('DISPLAY', 'comm_delay',            1,  3, FALSE),
    ('DISPLAY', 'display_error_count',   2,  3, TRUE),
    ('DISPLAY', 'last_received_minutes', 3, 10, TRUE),
    ('DISPLAY', 'power_error_count',     4,  2, TRUE),
    ('CCTV',    'stream_drop_count',     1,  5, TRUE),
    ('CCTV',    'frame_loss_rate',       2, 10, FALSE),
    ('CCTV',    'last_received_minutes', 3, 10, TRUE),
    ('CCTV',    'image_quality_index',   4,  6, FALSE)
),
-- 나빠지는 설비: 7일 전 비율(start) → 지금 비율(stop). 비율 = 측정값 / 기준값 (1 이상이면 기준 초과)
degrade(underpass_id, type, metric, start_r, stop_r) AS (VALUES
    (13, 'PUMP', 'motor_current_rise',   0.60, 1.70),   -- 34%
    (13, 'PUMP', 'start_error_count',    0.40, 1.40),   -- 7회
    (13, 'PUMP', 'drain_response_delay', 0.50, 0.75),   -- 22.5초
    (13, 'PUMP', 'vibration_index',      0.30, 0.83),   -- 5.8
    (13, 'PUMP', 'no_data_minutes',      0.00, 0.00),
    (22, 'PUMP', 'motor_current_rise',   0.50, 0.80),
    (22, 'PUMP', 'start_error_count',    0.20, 0.40),
    (22, 'PUMP', 'drain_response_delay', 0.30, 0.45),
    (22, 'PUMP', 'vibration_index',      0.20, 0.35),
    (22, 'PUMP', 'no_data_minutes',      0.00, 0.00),
    (14, 'CCTV', 'stream_drop_count',     0.50, 1.00),
    (14, 'CCTV', 'frame_loss_rate',       0.40, 0.80),
    (14, 'CCTV', 'last_received_minutes', 0.10, 0.20),
    (14, 'CCTV', 'image_quality_index',   0.20, 0.30),
    (18, 'DISPLAY', 'comm_delay',            0.50, 0.90),
    (18, 'DISPLAY', 'display_error_count',   0.30, 0.67),
    (18, 'DISPLAY', 'last_received_minutes', 0.10, 0.20),
    (18, 'DISPLAY', 'power_error_count',     0.20, 0.50)
),
tick AS (   -- 6시간 간격 29번: 7일 전 ~ 지금(정시)
    SELECT t, date_trunc('hour', LOCALTIMESTAMP) - (28 - t) * INTERVAL '6 hours' AS at
    FROM generate_series(0, 28) AS t
),
raw AS (
    SELECT e.id AS equip_id, r.metric, r.lim, r.is_count, k.at,
           CASE WHEN d.metric IS NOT NULL THEN
                    -- 나빠지는 설비: 직선으로 오르고, 마지막 값(t=28)만 흔들림 없이 정확히
                    d.start_r + (d.stop_r - d.start_r) * k.t / 28.0
                    + CASE WHEN k.t = 28 THEN 0 ELSE (((e.id * 7 + k.t * 13 + r.rank * 5) % 11) - 5) / 200.0 END
                ELSE
                    -- 정상 설비: 기준값의 3~25% 사이에서 조금씩 오르내림
                    0.03 + 0.22 * (((e.id * 37 + k.t * 11 + r.rank * 53) % 97) / 97.0)
           END AS ratio
    FROM pm_equipment e
    JOIN rule r ON r.type = e.type::text
    CROSS JOIN tick k
    LEFT JOIN degrade d ON d.underpass_id = e.underpass_id AND d.type = e.type::text AND d.metric = r.metric
)
INSERT INTO pm_sensor (equip_id, metric, value, recorded_at)
SELECT equip_id, metric,
       CASE WHEN is_count THEN ROUND(GREATEST(ratio, 0) * lim) ELSE ROUND(GREATEST(ratio, 0) * lim, 1) END,
       at
FROM raw
ORDER BY at, equip_id, metric;

-- 3) 지난 점검 이력 (이미 끝난 것). 관리자 id = 그 지역 담당 (seed: 동구=3, 부산진구=5, 동래구=6)
WITH past(underpass_id, type, level, score, reason, status, days_ago) AS (VALUES
    (12, 'PUMP',    '주의', 72.0, '배수 응답 지연 42초 (기준 30초) 외 1건',  'RESOLVED', 10),
    (22, 'PUMP',    '주의', 58.0, '모터 전류 상승률 18% (기준 20%) 외 2건', 'ETC',      11),
    (13, 'PUMP',    '주의', 50.0, '진동 지수 6.1 (기준 7) 외 1건',          'RESOLVED', 15),
    (18, 'DISPLAY', '주의', 60.0, '통신 지연 3.4초 (기준 3초) 외 1건',      'RESOLVED', 20)
)
INSERT INTO pm_event (equip_id, level, score, reason, status, created_at)
SELECT e.id, p.level::pm_level, p.score, p.reason, p.status::pm_event_status,
       LOCALTIMESTAMP - p.days_ago * INTERVAL '1 day'
FROM past p
JOIN pm_equipment e ON e.underpass_id = p.underpass_id AND e.type::text = p.type
ORDER BY p.days_ago DESC;

WITH act(underpass_id, type, manager_id, content, days_ago, hours_after) AS (VALUES
    (12, 'PUMP',    3, '현장 확인: 흡입구에 낙엽·이물질 많음',        10,  2),
    (12, 'PUMP',    3, '흡입 필터 교체 후 시운전, 정상 복구',          10, 26),
    (22, 'PUMP',    5, '벨트 장력 확인, 윤활. 모터 추가 점검 필요',    11,  4),
    (13, 'PUMP',    3, '정기 점검, 이상 없음',                         15,  3),
    (18, 'DISPLAY', 6, '통신 모듈 재시작, 표출 정상 확인',             20,  1)
)
INSERT INTO pm_action (event_id, content, manager_id, created_at)
SELECT ev.id, a.content, a.manager_id,
       LOCALTIMESTAMP - a.days_ago * INTERVAL '1 day' + a.hours_after * INTERVAL '1 hour'
FROM act a
JOIN pm_equipment e ON e.underpass_id = a.underpass_id AND e.type::text = a.type
JOIN pm_event ev ON ev.equip_id = e.id
ORDER BY 4;

-- 확인용
SELECT (SELECT COUNT(*) FROM pm_sensor) AS sensor_rows,
       (SELECT COUNT(*) FROM pm_event)  AS past_events,
       (SELECT COUNT(*) FROM pm_action) AS actions;
