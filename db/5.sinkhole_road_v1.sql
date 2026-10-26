-- 기존 v9 DB에 적용. public 스키마를 삭제하지 않는다.
-- ALTER TYPE 새 값은 COMMIT 이후 사용 가능: 이 파일 전체를 단일 트랜잭션으로 감싸지 말 것.
ALTER TYPE pm_equipment_type ADD VALUE IF NOT EXISTS 'ROAD';
ALTER TYPE pm_trigger_type ADD VALUE IF NOT EXISTS '싱크홀탐지';

BEGIN;
ALTER TABLE pm_equipment ALTER COLUMN sensor_interval_sec DROP NOT NULL;
ALTER TABLE pm_equipment DROP CONSTRAINT IF EXISTS chk_pm_equipment_interval;
ALTER TABLE pm_equipment ADD CONSTRAINT chk_pm_equipment_interval CHECK (
    (type = 'ROAD' AND sensor_interval_sec IS NULL) OR
    (type <> 'ROAD' AND sensor_interval_sec IS NOT NULL AND sensor_interval_sec > 0));
ALTER TABLE pm_event DROP CONSTRAINT IF EXISTS chk_pm_event_trigger;
ALTER TABLE pm_event ADD CONSTRAINT chk_pm_event_trigger CHECK (
    trigger_type IN ('미수신', '싱크홀탐지') OR (score IS NOT NULL AND level IS NOT NULL));

CREATE OR REPLACE FUNCTION pm_equipment_before_insert() RETURNS trigger AS $$
DECLARE v_letter CHAR(1); v_seq INTEGER;
BEGIN
    IF NEW.type::text = 'ROAD' THEN NEW.sensor_interval_sec := NULL;
    ELSIF NEW.sensor_interval_sec IS NULL THEN
        NEW.sensor_interval_sec := CASE NEW.type::text
            WHEN 'CCTV' THEN 3600 WHEN 'DISPLAY' THEN 3600 WHEN 'WATER_LEVEL' THEN 300 WHEN 'PUMP' THEN 10 END;
    END IF;
    IF NEW.name IS NULL THEN
        v_letter := CASE NEW.type::text WHEN 'CCTV' THEN 'C' WHEN 'DISPLAY' THEN 'D'
            WHEN 'WATER_LEVEL' THEN 'W' WHEN 'PUMP' THEN 'P' WHEN 'ROAD' THEN 'R' END;
        PERFORM pg_advisory_xact_lock(7001, NEW.underpass_id::int);
        SELECT COALESCE(MAX(split_part(e.name, '-', 3)::int), 0) + 1 INTO v_seq
        FROM pm_equipment e WHERE e.underpass_id = NEW.underpass_id AND e.type = NEW.type;
        NEW.name := v_letter || '-' || NEW.underpass_id || '-' || v_seq;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 노면 분석 결과. 사진 원본은 Spring의 별도 파일 저장소에 보관한다.
CREATE TABLE IF NOT EXISTS pm_road_result (
    id BIGSERIAL PRIMARY KEY,
    job_id VARCHAR(64) NOT NULL UNIQUE,
    equip_id BIGINT NOT NULL REFERENCES pm_equipment(id),
    camera_id BIGINT REFERENCES camera(id),
    event_id BIGINT REFERENCES pm_event(id),
    analyzed_at TIMESTAMP NOT NULL,
    detected BOOLEAN NOT NULL,
    confidence DECIMAL(6,5) CHECK (confidence BETWEEN 0 AND 1),
    detection_count INTEGER NOT NULL CHECK (detection_count >= 0),
    frame_seconds DOUBLE PRECISION CHECK (frame_seconds >= 0),
    model_version VARCHAR(80) NOT NULL,
    image_name VARCHAR(80),
    review_status VARCHAR(24) NOT NULL DEFAULT 'PENDING'
        CHECK (review_status IN ('PENDING', 'CONFIRMED', 'FALSE_POSITIVE', 'RESOLVED')),
    reviewed_by BIGINT REFERENCES manager(id),
    reviewed_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CHECK (NOT detected OR (image_name IS NOT NULL AND confidence IS NOT NULL)),
    CHECK (NOT detected OR event_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_pm_road_result_latest ON pm_road_result(equip_id, analyzed_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_pm_road_result_event ON pm_road_result(event_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_pm_event_open_sinkhole ON pm_event(equip_id)
    WHERE trigger_type = '싱크홀탐지' AND status IN ('CHECK_NEEDED', 'IN_PROGRESS');

DO $$ BEGIN
    IF (SELECT COUNT(*) FROM underpass WHERE name = '초량지하차도' AND is_deleted = FALSE) <> 1 THEN
        RAISE EXCEPTION '초량지하차도 활성 데이터가 정확히 1건 있어야 합니다.';
    END IF;
END $$;

-- 초량지하차도 노면: 반복 실행 시 중복 등록하지 않는다. 카메라는 사진 전송 시 소속을 검증한다.
INSERT INTO pm_equipment (underpass_id, type)
SELECT u.id, 'ROAD'::pm_equipment_type FROM underpass u
WHERE u.name = '초량지하차도' AND u.is_deleted = FALSE
AND NOT EXISTS (SELECT 1 FROM pm_equipment e WHERE e.underpass_id = u.id AND e.type = 'ROAD' AND e.is_deleted = FALSE);

COMMIT;
