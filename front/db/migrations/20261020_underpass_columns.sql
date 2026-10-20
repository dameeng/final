-- puf-backend-g.zip / puf_db_schema_v3.sql 기준 누락 컬럼 보완.
-- 백엔드가 연결한 PostgreSQL DB에서 실행합니다.
-- 기존 행과 컬럼 값은 유지하고, 새 컬럼은 실제 값이 없으므로 NULL로 둡니다.

SELECT current_database() AS database_name, current_schema() AS schema_name;

BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE public.underpass
    ADD COLUMN IF NOT EXISTS lanes INTEGER,
    ADD COLUMN IF NOT EXISTS safety_grade VARCHAR(10),
    ADD COLUMN IF NOT EXISTS river_dist DECIMAL(10,1),
    ADD COLUMN IF NOT EXISTS sea_dist DECIMAL(10,1);

COMMIT;

SELECT column_name, data_type, character_maximum_length, numeric_precision, numeric_scale
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'underpass'
  AND column_name IN ('lanes', 'safety_grade', 'river_dist', 'sea_dist')
ORDER BY ordinal_position;
