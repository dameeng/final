-- =====================================================================
-- PUF 예지보전 업데이트 v1 (4.pm_update_v1.sql)
-- 실행 전제: 1.puf_db_schema_v8.sql → 2.seed_all_v8.sql → 3.seed_its_v8.sql 실행 완료 (이 파일은 그 다음에 실행)
-- 실행 방법: 자동 커밋(autocommit)으로 위에서 아래로 실행. 예) psql -U postgres -d mydb -f 4.pm_update_v1.sql
--            ※ 전체를 BEGIN ... COMMIT 한 트랜잭션으로 묶지 말 것
--              (1번에서 추가한 'WATER_LEVEL' 값은 커밋된 뒤에야 4번에서 쓸 수 있음)
-- 두 번 실행해도 결과가 같음 (이미 있는 컬럼·제약·설비는 건너뜀)
--
-- 바뀌는 것
--   · 전체: 설비 종류 WATER_LEVEL 추가, pm_score 에 단계·사유·세부값·모델버전 컬럼 + (설비, 시각) 중복 금지
--   · 초량지하차도만: 설비를 CCTV 1 · 전광판 2(3부두, 영주교차로) · 배수펌프 2 · 수위센서 7 로 맞추고 임계치 안전 0 / 주의 40 / 위험 70
--   · 다른 지하차도는 설비·임계치를 건드리지 않음
-- 초량지하차도는 id 가 아니라 이름으로 찾음 (DB 마다 id 가 달라도 같게 동작)
-- 점검 이벤트·점수는 넣지 않음: 예지보전 서버(8002)가 점수를 보내면 Spring 이 임계치로 판정해서 만듦
-- =====================================================================

-- =====================================================================
-- 1. 설비 종류에 수위센서 추가 (예지보전 대상 = 수위계 장비 자체의 고장 여부. 물 높이 측정값은 water_level 테이블)
-- =====================================================================
ALTER TYPE pm_equipment_type ADD VALUE IF NOT EXISTS 'WATER_LEVEL';

-- =====================================================================
-- 2. pm_score — 예지보전 서버가 보내는 값을 같이 저장
-- =====================================================================
ALTER TABLE pm_score ADD COLUMN IF NOT EXISTS level pm_level;               -- 판정 단계(Spring 이 pm_threshold 로 판정해서 저장)
ALTER TABLE pm_score ADD COLUMN IF NOT EXISTS reasons JSONB;                -- 사유 문장 목록(예: ["영상 수신률 평소보다 매우 많이 낮아요"])
ALTER TABLE pm_score ADD COLUMN IF NOT EXISTS detail JSONB;                 -- 모델별 세부값(CCTV 항목별 현재/평소, 전광판 의심원인, 펌프 센서, 수위 이상유형)
ALTER TABLE pm_score ADD COLUMN IF NOT EXISTS model_version VARCHAR(30);    -- 점수를 만든 모델 버전(시연 재생 = 'replay-v1')

-- =====================================================================
-- 3. pm_score — 같은 설비·같은 시각 점수 중복 금지
--    예지보전 서버를 다시 켜면 지난 7일치(정각)를 또 보내므로, Spring 은 ON CONFLICT DO NOTHING 으로 건너뜀
--    이 제약이 (equip_id, predicted_at) 인덱스를 만들어서 기존 idx_pm_score_equip_time 은 지움
-- =====================================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_pm_score_equip_time') THEN
        ALTER TABLE pm_score ADD CONSTRAINT uq_pm_score_equip_time UNIQUE (equip_id, predicted_at);
    END IF;
END $$;

DROP INDEX IF EXISTS idx_pm_score_equip_time;

-- =====================================================================
-- 4. 초량지하차도 설비 — 모자란 만큼만 추가 (CCTV 1대는 seed_its_v8 에서 이미 있음)
-- =====================================================================

-- 4-1. 수위센서 7대
INSERT INTO pm_equipment (underpass_id, type)
SELECT u.id, 'WATER_LEVEL'
FROM underpass u
CROSS JOIN generate_series(1, 7) AS g(n)
WHERE u.name = '초량지하차도' AND u.is_deleted = FALSE
  AND g.n > (SELECT COUNT(*) FROM pm_equipment e WHERE e.underpass_id = u.id AND e.type = 'WATER_LEVEL')
ORDER BY g.n;

-- 4-2. 배수펌프 2대
INSERT INTO pm_equipment (underpass_id, type)
SELECT u.id, 'PUMP'
FROM underpass u
CROSS JOIN generate_series(1, 2) AS g(n)
WHERE u.name = '초량지하차도' AND u.is_deleted = FALSE
  AND g.n > (SELECT COUNT(*) FROM pm_equipment e WHERE e.underpass_id = u.id AND e.type = 'PUMP')
ORDER BY g.n;

-- 4-3. 전광판 — 표출 매핑(vms_underpass)에 있는 '영주교차로' 전광판을 초량 설비로 추가 (3부두는 seed_its_v8 에서 이미 있음)
--      한 전광판은 한 설비에만 귀속(its_vms_id UNIQUE)이라, 다른 설비에 이미 붙어 있으면 건너뜀
INSERT INTO pm_equipment (underpass_id, type, its_vms_id)
SELECT vu.underpass_id, 'DISPLAY', vu.its_vms_id
FROM vms_underpass vu
JOIN its_vms v ON v.id = vu.its_vms_id
JOIN underpass u ON u.id = vu.underpass_id
WHERE u.name = '초량지하차도' AND u.is_deleted = FALSE
  AND v.name = '영주교차로'
  AND NOT EXISTS (SELECT 1 FROM pm_equipment e WHERE e.its_vms_id = vu.its_vms_id);

-- =====================================================================
-- 5. 초량지하차도 설비 임계치 — 안전 0 / 주의 40 / 위험 70 (프론트 표시 기준 0~39 안전 · 40~69 주의 · 70 이상 위험)
--    새 설비는 추가, 기존 설비(CCTV 40/65, 전광판 50/80, 펌프 45/75)는 값만 바꿈
--    updated_by = 그 지하차도 지역을 담당하는 관리자 (seed_all_v8 13번과 같은 방식)
-- =====================================================================
INSERT INTO pm_threshold (equip_id, level, min_score, updated_by)
SELECT e.id, s.level::pm_level, s.min_score,
       (SELECT MIN(mr.manager_id) FROM manager_region mr WHERE mr.region_id = u.region_id)
FROM pm_equipment e
JOIN underpass u ON u.id = e.underpass_id
CROSS JOIN (VALUES ('안전', 0), ('주의', 40), ('위험', 70)) AS s(level, min_score)
WHERE u.name = '초량지하차도' AND u.is_deleted = FALSE
ORDER BY e.id, s.min_score
ON CONFLICT (equip_id, level) DO UPDATE
SET min_score = EXCLUDED.min_score, updated_at = NOW()
WHERE pm_threshold.min_score <> EXCLUDED.min_score;

-- =====================================================================
-- 6. 확인용 — 초량지하차도 설비 종류별 대수와 임계치 (기대값: CCTV 1 · DISPLAY 2 · PUMP 2 · WATER_LEVEL 7, 모두 0/40/70)
-- =====================================================================
SELECT e.type,
       COUNT(DISTINCT e.id) AS 설비수,
       STRING_AGG(DISTINCT e.id::text, ',') AS 설비ID,
       STRING_AGG(DISTINCT t.level::text || ' ' || t.min_score::text, ' / ') AS 임계치
FROM pm_equipment e
JOIN underpass u ON u.id = e.underpass_id
LEFT JOIN pm_threshold t ON t.equip_id = e.id
WHERE u.name = '초량지하차도'
GROUP BY e.type
ORDER BY e.type;
