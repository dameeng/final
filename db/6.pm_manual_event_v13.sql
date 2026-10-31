-- v13: 점검 수동 등록 (pm_event.trigger_type '수동등록' 추가)
-- 주의: ALTER TYPE ... ADD VALUE 는 트랜잭션 블록 밖에서 실행한다. (psql 에서 BEGIN 없이 그대로 실행, 재실행 가능)
ALTER TYPE pm_trigger_type ADD VALUE IF NOT EXISTS '수동등록';

-- 위에서 추가한 값은 같은 트랜잭션에서 쓸 수 없으므로, 아래는 별도 실행(자동 커밋)해도 된다.
-- 수동등록은 점수·단계 없이도 저장되도록 제약을 완화한다.
ALTER TABLE pm_event DROP CONSTRAINT IF EXISTS chk_pm_event_trigger;
ALTER TABLE pm_event
ADD CONSTRAINT chk_pm_event_trigger
CHECK (trigger_type IN ('미수신', '싱크홀탐지', '수동등록') OR (score IS NOT NULL AND level IS NOT NULL));

-- 같은 설비의 처리 안 끝난 수동등록 이벤트는 1건만 (동시 클릭 방지)
CREATE UNIQUE INDEX IF NOT EXISTS uq_pm_event_open_manual ON pm_event (equip_id)
    WHERE trigger_type = '수동등록' AND status IN ('CHECK_NEEDED', 'IN_PROGRESS');
