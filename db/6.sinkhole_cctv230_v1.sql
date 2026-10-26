-- 초량지하차도 CCTV230의 시연 영상을 싱크홀 서버로 연결. 기존 226~229는 변경하지 않는다.
BEGIN;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM camera c JOIN underpass u ON u.id=c.underpass_id
                   WHERE c.id=230 AND u.name='초량지하차도' AND NOT c.is_deleted AND NOT u.is_deleted) THEN
        RAISE EXCEPTION '활성 초량지하차도 CCTV230이 필요합니다. 다른 카메라의 소속을 자동 변경하지 않습니다.';
    END IF;
END $$;
UPDATE camera SET stream_url='http://localhost:8003/stream/230'
WHERE id=230 AND underpass_id=(SELECT id FROM underpass WHERE name='초량지하차도' AND NOT is_deleted);
COMMIT;
