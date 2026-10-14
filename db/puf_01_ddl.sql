-- =====================================================================
-- PUF DB 리셋 + 스키마 생성 (ENUM / TABLE / CHECK / FK / INDEX / weather_hourly VIEW) — 시드 데이터 없음
-- 실행 후 puf_02_seed.sql 을 이어서 실행
-- ⚠️ 개발 DB 전용. public 스키마를 통째로 지우므로 되돌릴 수 없음. 운영 DB 실행 금지.
-- 실행 순서: 스키마 리셋 → ENUM → 테이블 → CHECK → FK/인덱스 → weather_hourly VIEW → 필수 기준행
-- =====================================================================

DROP SCHEMA public CASCADE;
CREATE SCHEMA public;

-- 1. ENUM 타입 생성
CREATE TYPE manager_role AS ENUM ('SUPER_ADMIN', 'REGIONAL_ADMIN'); -- 관리자 구분(최고관리자/지역담당자)
CREATE TYPE manager_status AS ENUM ('PENDING', 'ACTIVE', 'WITHDRAWN'); -- 관리자 계정 상태(가입 대기/활성화/탈퇴)
CREATE TYPE verification_purpose AS ENUM ('SIGNUP', 'PASSWORD_RESET'); -- 인증코드 발송 이유(가입/비밀번호 재설정)
CREATE TYPE camera_role AS ENUM ('CCTV', 'APPROACH_LPR', 'ROI_LPR'); -- 카메라 역할(일반 CCTV/접근길목 번호판인식/진입직전 최종확인)
CREATE TYPE recognition_status AS ENUM ('SUCCESS', 'LOW_CONFIDENCE', 'FAIL', 'UNMATCHED'); -- 번호판 인식 상태(성공/신뢰도 낮음/실패/미매칭)
CREATE TYPE review_status AS ENUM ('NONE', 'PENDING', 'CONFIRMED', 'AUTO_PROCESSED'); -- 수동 검토 상태(필요없음/대기중/확인완료/자동처리)
CREATE TYPE underpass_current_status AS ENUM ('NORMAL', 'BLOCKED'); -- 지하차도 현재 상태(정상/차단)
CREATE TYPE underpass_event_type AS ENUM ('RISK_LEVEL_UP', 'RISK_LEVEL_DOWN', 'BLOCK', 'RELEASE'); -- 지하차도 이벤트 종류(위험도상승/위험도하강/차단/해제)
CREATE TYPE risk_level AS ENUM ('안전', '경고', '위험'); -- 위험도 단계
CREATE TYPE alert_type AS ENUM ('PREDICTIVE', 'ROI_FINAL'); -- 알림 종류(사전예측/진입직전 최후확인)
CREATE TYPE display_message_type AS ENUM ('RISK_WARNING', 'BLOCK_NOTICE', 'RELEASE_NOTICE'); -- 전광판 표출 메시지 종류
CREATE TYPE transit_status AS ENUM ('IN_TRANSIT', 'EXITED', 'REMAINING'); -- 지하차도 통과 상태(진입중/정상통과/잔류)
CREATE TYPE inquiry_status AS ENUM ('PENDING', 'ANSWERED'); -- 접수의견 답변 여부(대기/답변완료)

-- 2. 테이블 생성

CREATE TABLE region ( -- 지역 테이블
    id BIGSERIAL PRIMARY KEY, -- 아이디
    name VARCHAR(50) NOT NULL, -- 지역 이름
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE -- 삭제 여부(소프트 삭제)
);

CREATE UNIQUE INDEX uq_region_name_active ON region (name) WHERE is_deleted = FALSE;

CREATE TABLE employee ( -- 직원 테이블(관리자 가입 시 대조용, 회사가 사전 등록)
    id BIGSERIAL PRIMARY KEY, -- 아이디
    name VARCHAR(50) NOT NULL, -- 이름
    birth_date DATE NOT NULL, -- 생년월일
    phone VARCHAR(20) NOT NULL, -- 전화번호
    email VARCHAR(100) UNIQUE NOT NULL -- 이메일
);

CREATE TABLE manager ( -- 관리자 계정 테이블
    id BIGSERIAL PRIMARY KEY, -- 아이디
    employee_id BIGINT NOT NULL, -- 직원 아이디
    login_id VARCHAR(50) UNIQUE NOT NULL, -- 로그인 아이디
    password VARCHAR(255) NOT NULL, -- 비밀번호
    role manager_role NOT NULL, -- 관리자 구분
    status manager_status NOT NULL DEFAULT 'PENDING', -- 계정 상태
    region_id BIGINT, -- 담당 지역 아이디(최고관리자는 NULL)
    created_at TIMESTAMP NOT NULL DEFAULT NOW(), -- 가입 요청 일자
    approved_by BIGINT, -- 승인한 관리자 아이디
    approved_at TIMESTAMP -- 승인 일자
);

CREATE TABLE customer ( -- 고객(일반 회원) 테이블
    id BIGSERIAL PRIMARY KEY, -- 아이디
    login_id VARCHAR(50) UNIQUE NOT NULL, -- 로그인 아이디
    password VARCHAR(255) NOT NULL, -- 비밀번호
    name VARCHAR(50) NOT NULL, -- 이름
    birth_date DATE NOT NULL, -- 생년월일
    email VARCHAR(100) UNIQUE NOT NULL, -- 이메일
    zipcode VARCHAR(10), -- 우편번호
    road_address VARCHAR(255), -- 도로명주소
    detail_address VARCHAR(255), -- 상세주소
    phone VARCHAR(20), -- 전화번호
    emergency VARCHAR(20), -- 긴급 연락처
    is_withdrawn BOOLEAN NOT NULL DEFAULT FALSE, -- 탈퇴 여부
    created_at TIMESTAMP NOT NULL DEFAULT NOW() -- 가입일
);

CREATE TABLE email_verification ( -- 이메일 인증코드 발송 내역 테이블
    id BIGSERIAL PRIMARY KEY, -- 아이디
    customer_id BIGINT, -- 고객 아이디(PASSWORD_RESET + 고객일 때만 값 있음)
    manager_id BIGINT, -- 관리자 아이디(PASSWORD_RESET + 관리자일 때만 값 있음)
    email VARCHAR(100), -- 인증 대상 이메일(SIGNUP일 때만 값 있음, 가입 전이라 계정 아이디가 없음)
    purpose verification_purpose NOT NULL, -- 발송 목적
    code VARCHAR(10) NOT NULL, -- 인증 코드
    expires_at TIMESTAMP NOT NULL, -- 만료 시각
    verified_at TIMESTAMP, -- 인증 완료 시각
    created_at TIMESTAMP NOT NULL DEFAULT NOW() -- 발송 시각
);

CREATE TABLE underpass ( -- 지하차도 마스터 테이블
    id BIGSERIAL PRIMARY KEY, -- 아이디
    name VARCHAR(100) NOT NULL, -- 이름
    region_id BIGINT NOT NULL, -- 지역 아이디
    road_address VARCHAR(255), -- 도로명주소
    latitude DECIMAL(10,7) NOT NULL, -- 위도
    longitude DECIMAL(10,7) NOT NULL, -- 경도
    height_m DECIMAL(4,2), -- 높이(층고, AI 모델 입력값)
    length_m DECIMAL(8,2), -- 길이(m)
    flood_history_count INT NOT NULL DEFAULT 0, -- 침수 이력 횟수
    entry_camera_id BIGINT, -- 입구 카메라 아이디
    exit_camera_id BIGINT, -- 출구 카메라 아이디
    current_status underpass_current_status NOT NULL DEFAULT 'NORMAL', -- 현재 상태
    current_block_event_id BIGINT, -- 차단 중이면 그 차단 이벤트 아이디
    current_risk_level risk_level NOT NULL DEFAULT '안전', -- 현재 위험도 단계(FastAPI 수신 시마다 갱신, 오르내림 둘 다 반영)
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE, -- 삭제 여부(소프트 삭제)
    created_at TIMESTAMP NOT NULL DEFAULT NOW() -- 등록일
);

CREATE TABLE underpass_camera ( -- 지하차도 카메라 등록 테이블
    id BIGSERIAL PRIMARY KEY, -- 아이디
    underpass_id BIGINT NOT NULL, -- 지하차도 아이디
    camera_role camera_role NOT NULL, -- 카메라 역할
    stream_url VARCHAR(255), -- 스트림 주소
    distance_m INT, -- 진입지점까지 거리(m)
    latitude DECIMAL(10,7), -- 위도
    longitude DECIMAL(10,7), -- 경도
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE, -- 삭제 여부(소프트 삭제, plate_log 참조 보존용)
    created_at TIMESTAMP NOT NULL DEFAULT NOW() -- 등록일
);

CREATE TABLE car ( -- 고객 등록 차량 테이블
    id BIGSERIAL PRIMARY KEY, -- 아이디
    customer_id BIGINT NOT NULL, -- 고객 아이디
    car_num VARCHAR(20) UNIQUE NOT NULL, -- 차량 번호(번호판 1개당 등록 고객 1명)
    created_at TIMESTAMP NOT NULL DEFAULT NOW() -- 등록일
);

CREATE TABLE plate_log ( -- 번호판 인식 이벤트 테이블
    id BIGSERIAL PRIMARY KEY, -- 아이디
    camera_id BIGINT NOT NULL, -- 카메라 아이디
    detected_num VARCHAR(20) NOT NULL, -- OCR 원본 인식 결과
    corrected_num VARCHAR(20), -- 관리자가 수동 수정한 값
    confidence DECIMAL(4,3), -- OCR 신뢰도
    image_path VARCHAR(255), -- 감지 순간 캡처 이미지 경로(FastAPI가 전송, 수동 판별용. 없을 수 있음)
    recognition_status recognition_status NOT NULL, -- 인식 상태
    car_id BIGINT, -- 매칭된 등록 차량 아이디(미매칭이면 NULL)
    review_status review_status NOT NULL DEFAULT 'NONE', -- 수동 검토 상태
    review_deadline TIMESTAMP, -- 검토 대기 만료 시각(초과 시 자동처리)
    reviewed_by BIGINT, -- 검토한 관리자 아이디
    reviewed_at TIMESTAMP, -- 검토 시각
    detected_at TIMESTAMP NOT NULL -- 인식 시각
);

CREATE TABLE underpass_transit ( -- 지하차도 입출구 통과(잔류차량 추적) 테이블
    id BIGSERIAL PRIMARY KEY, -- 아이디
    underpass_id BIGINT NOT NULL, -- 지하차도 아이디
    car_num VARCHAR(20), -- 차량 번호
    entry_plate_log_id BIGINT NOT NULL, -- 입구 인식 로그 아이디
    exit_plate_log_id BIGINT, -- 출구 인식 로그 아이디(통과 전이면 NULL)
    status transit_status NOT NULL DEFAULT 'IN_TRANSIT', -- 통과 상태
    entry_at TIMESTAMP NOT NULL, -- 진입 시각
    exit_at TIMESTAMP -- 통과 시각
);

CREATE TABLE underpass_event ( -- 지하차도 이벤트 테이블(위험도상승/차단/해제)
    id BIGSERIAL PRIMARY KEY, -- 아이디
    underpass_id BIGINT NOT NULL, -- 지하차도 아이디
    event_type underpass_event_type NOT NULL, -- 이벤트 종류
    risk_level risk_level, -- 위험도 단계(RISK_LEVEL_UP일 때만 값 있음)
    risk_score_at_event DECIMAL(5,2), -- 이벤트 발생 시점의 위험도 점수(0~100, RISK_LEVEL_UP/DOWN일 때만)
    operator_id BIGINT, -- 실행한 관리자 아이디(BLOCK/RELEASE일 때만)
    created_at TIMESTAMP NOT NULL DEFAULT NOW() -- 발생 시각
);

CREATE TABLE alert_log ( -- 개인화 알림 발송 이력 테이블
    id BIGSERIAL PRIMARY KEY, -- 아이디
    event_id BIGINT NOT NULL, -- 계기가 된 지하차도 이벤트 아이디
    customer_id BIGINT NOT NULL, -- 수신 고객 아이디
    car_id BIGINT, -- 매칭된 차량 아이디(삭제 시 NULL)
    car_num VARCHAR(20) NOT NULL, -- 발송 시점 번호판 스냅샷
    alert_type alert_type NOT NULL, -- 알림 종류
    sent_at TIMESTAMP NOT NULL DEFAULT NOW() -- 발송 시각
);

CREATE TABLE display_log ( -- 전광판 조작 로그 테이블
    id BIGSERIAL PRIMARY KEY, -- 아이디
    underpass_id BIGINT NOT NULL, -- 지하차도 아이디
    message_type display_message_type NOT NULL, -- 표출 메시지 종류
    operator_id BIGINT NOT NULL, -- 조작한 관리자 아이디
    created_at TIMESTAMP NOT NULL DEFAULT NOW() -- 조작 시각
);

CREATE TABLE risk_score ( -- 위험도 예측 결과 테이블
    id BIGSERIAL PRIMARY KEY, -- 아이디
    underpass_id BIGINT NOT NULL, -- 지하차도 아이디
    risk_score DECIMAL(5,2) NOT NULL, -- 예측 위험도 점수(0~100, AI 모델 표시점수. 확률 아님)
    rainfall_mm DECIMAL(6,2), -- 현재(이번 시간) 강수량(mm). 관측 실패 시 NULL 허용
    rainfall_1h_mm DECIMAL(6,2), -- 직전 1시간 강수량(mm)
    rainfall_3h_mm DECIMAL(6,2), -- 최근 3시간 누적 강수량(mm)
    rainfall_6h_mm DECIMAL(6,2), -- 최근 6시간 누적 강수량(mm)
    rainfall_12h_mm DECIMAL(6,2), -- 최근 12시간 누적 강수량(mm)
    rainfall_24h_mm DECIMAL(6,2), -- 최근 24시간 누적 강수량(mm)
    predicted_at TIMESTAMP NOT NULL -- 예측 계산 시각
);

CREATE TABLE threshold ( -- 지하차도별 위험도 임계치 테이블
    id BIGSERIAL PRIMARY KEY, -- 아이디
    underpass_id BIGINT NOT NULL, -- 지하차도 아이디
    level risk_level NOT NULL, -- 임계치 단계
    risk_score_min DECIMAL(5,2) NOT NULL, -- 해당 단계로 판정되는 위험도 하한값(0~100)
    updated_by BIGINT NOT NULL, -- 마지막 수정 관리자 아이디
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(), -- 마지막 수정 시각
    UNIQUE (underpass_id, level)
);

CREATE TABLE threshold_history ( -- 임계치 변경 이력 테이블(최초 생성분부터 기록)
    id BIGSERIAL PRIMARY KEY, -- 아이디
    threshold_id BIGINT NOT NULL, -- 임계치 아이디
    old_risk_score_min DECIMAL(5,2), -- 변경 전 값(최초 생성이면 NULL, 0~100)
    new_risk_score_min DECIMAL(5,2) NOT NULL, -- 변경 후 값(0~100)
    changed_by BIGINT NOT NULL, -- 변경한 관리자 아이디
    changed_at TIMESTAMP NOT NULL DEFAULT NOW() -- 변경 시각
);

CREATE TABLE notice ( -- 공지사항 테이블
    id BIGSERIAL PRIMARY KEY, -- 아이디
    title VARCHAR(200) NOT NULL, -- 제목
    content TEXT NOT NULL, -- 내용
    is_important BOOLEAN NOT NULL DEFAULT FALSE, -- 중요공지 여부
    author_id BIGINT NOT NULL, -- 작성 관리자 아이디
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE, -- 삭제 여부(소프트 삭제)
    created_at TIMESTAMP NOT NULL DEFAULT NOW(), -- 작성일
    updated_at TIMESTAMP NOT NULL DEFAULT NOW() -- 수정일
);

CREATE TABLE notice_attachment ( -- 공지사항 첨부파일 테이블
    id BIGSERIAL PRIMARY KEY, -- 아이디
    notice_id BIGINT NOT NULL, -- 공지사항 아이디
    file_url VARCHAR(255) NOT NULL, -- 파일 경로
    file_name VARCHAR(255) NOT NULL, -- 파일명
    created_at TIMESTAMP NOT NULL DEFAULT NOW() -- 업로드 시각
);

CREATE TABLE faq ( -- 자주묻는질문 테이블(질문/답변 1행 구성)
    id BIGSERIAL PRIMARY KEY, -- 아이디
    question TEXT NOT NULL, -- 질문
    answer TEXT NOT NULL, -- 답변
    author_id BIGINT NOT NULL, -- 작성 관리자 아이디
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE, -- 삭제 여부(소프트 삭제)
    created_at TIMESTAMP NOT NULL DEFAULT NOW(), -- 작성일
    updated_at TIMESTAMP NOT NULL DEFAULT NOW() -- 수정일
);

CREATE TABLE faq_attachment ( -- FAQ 첨부파일 테이블
    id BIGSERIAL PRIMARY KEY, -- 아이디
    faq_id BIGINT NOT NULL, -- FAQ 아이디
    file_url VARCHAR(255) NOT NULL, -- 파일 경로
    file_name VARCHAR(255) NOT NULL, -- 파일명
    created_at TIMESTAMP NOT NULL DEFAULT NOW() -- 업로드 시각
);

CREATE TABLE inquiry ( -- 접수의견(1:1 문의) 테이블, 자기참조로 답글 표현
    id BIGSERIAL PRIMARY KEY, -- 아이디
    parent_id BIGINT, -- 원글 아이디(NULL이면 원글, 값 있으면 그 원글의 답글)
    customer_id BIGINT, -- 작성 고객 아이디(원글만 값 있음)
    author_manager_id BIGINT, -- 답변 관리자 아이디(답글만 값 있음)
    title VARCHAR(200), -- 제목(원글만 값 있음)
    content TEXT NOT NULL, -- 내용
    status inquiry_status NOT NULL DEFAULT 'PENDING', -- 답변 여부(원글 행 기준)
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE, -- 삭제 여부(소프트 삭제)
    created_at TIMESTAMP NOT NULL DEFAULT NOW() -- 작성일
);

CREATE TABLE inquiry_attachment ( -- 접수의견 첨부파일 테이블
    id BIGSERIAL PRIMARY KEY, -- 아이디
    inquiry_id BIGINT NOT NULL, -- 접수의견 아이디
    file_url VARCHAR(255) NOT NULL, -- 파일 경로
    file_name VARCHAR(255) NOT NULL, -- 파일명
    created_at TIMESTAMP NOT NULL DEFAULT NOW() -- 업로드 시각
);

-- ---- 날씨(CP-08): weather_area는 기준 테이블, weather_hourly는 아래 VIEW ----
CREATE TABLE weather_area ( -- 날씨 지역(고객 웹 날씨 화면의 지역 선택 목록과 같은 9곳)
    id BIGSERIAL PRIMARY KEY, -- 아이디
    name VARCHAR(50) NOT NULL UNIQUE, -- 지역 이름
    latitude DECIMAL(10,7) NOT NULL, -- 위도
    longitude DECIMAL(10,7) NOT NULL -- 경도
);

-- 3. 특수 조건 추가 (CHECK 제약 조건)
-- 가입 인증(SIGNUP): 계정이 아직 없으므로 이메일만 기록 / 비밀번호 재설정: 고객·관리자 계정 중 정확히 하나
ALTER TABLE email_verification
ADD CONSTRAINT chk_email_verification_owner
CHECK (
    (purpose = 'SIGNUP' AND email IS NOT NULL AND customer_id IS NULL AND manager_id IS NULL) OR
    (purpose = 'PASSWORD_RESET' AND ((customer_id IS NULL) <> (manager_id IS NULL)))
);

ALTER TABLE underpass_event
ADD CONSTRAINT chk_underpass_event_cond
CHECK (
    (event_type IN ('RISK_LEVEL_UP', 'RISK_LEVEL_DOWN') AND risk_level IS NOT NULL AND risk_score_at_event IS NOT NULL) OR
    (event_type IN ('BLOCK', 'RELEASE') AND operator_id IS NOT NULL)
);

ALTER TABLE inquiry
ADD CONSTRAINT chk_inquiry_author
CHECK ((customer_id IS NULL) <> (author_manager_id IS NULL));

-- 4. 외래 키 (Foreign Key) 설정
ALTER TABLE manager ADD CONSTRAINT fk_manager_employee FOREIGN KEY (employee_id) REFERENCES employee(id);
ALTER TABLE manager ADD CONSTRAINT fk_manager_region FOREIGN KEY (region_id) REFERENCES region(id);
ALTER TABLE manager ADD CONSTRAINT fk_manager_approved FOREIGN KEY (approved_by) REFERENCES manager(id);

-- 같은 직원이 WITHDRAWN이 아닌 관리자 계정을 동시에 여러 개 가질 수 없도록 방지
-- (탈퇴 후 재가입은 허용, 활성/대기 상태 중복만 차단)
CREATE UNIQUE INDEX uq_manager_employee_active
ON manager (employee_id)
WHERE status <> 'WITHDRAWN';

ALTER TABLE email_verification ADD CONSTRAINT fk_email_customer FOREIGN KEY (customer_id) REFERENCES customer(id);
ALTER TABLE email_verification ADD CONSTRAINT fk_email_manager FOREIGN KEY (manager_id) REFERENCES manager(id);

ALTER TABLE underpass ADD CONSTRAINT fk_underpass_region FOREIGN KEY (region_id) REFERENCES region(id);
ALTER TABLE underpass ADD CONSTRAINT fk_underpass_entry_cam FOREIGN KEY (entry_camera_id) REFERENCES underpass_camera(id);
ALTER TABLE underpass ADD CONSTRAINT fk_underpass_exit_cam FOREIGN KEY (exit_camera_id) REFERENCES underpass_camera(id);
ALTER TABLE underpass ADD CONSTRAINT fk_underpass_block_event FOREIGN KEY (current_block_event_id) REFERENCES underpass_event(id);

ALTER TABLE underpass_camera ADD CONSTRAINT fk_camera_underpass FOREIGN KEY (underpass_id) REFERENCES underpass(id);

ALTER TABLE car ADD CONSTRAINT fk_car_customer FOREIGN KEY (customer_id) REFERENCES customer(id);

ALTER TABLE plate_log ADD CONSTRAINT fk_plate_camera FOREIGN KEY (camera_id) REFERENCES underpass_camera(id);
-- (FK 해제) 고객/차량 삭제와 무관하게 로그를 보존하기 위해 car/customer 참조 FK를 두지 않음: fk_plate_car
ALTER TABLE plate_log ADD CONSTRAINT fk_plate_manager FOREIGN KEY (reviewed_by) REFERENCES manager(id);

ALTER TABLE underpass_transit ADD CONSTRAINT fk_transit_underpass FOREIGN KEY (underpass_id) REFERENCES underpass(id);
ALTER TABLE underpass_transit ADD CONSTRAINT fk_transit_entry_log FOREIGN KEY (entry_plate_log_id) REFERENCES plate_log(id);
ALTER TABLE underpass_transit ADD CONSTRAINT fk_transit_exit_log FOREIGN KEY (exit_plate_log_id) REFERENCES plate_log(id);

ALTER TABLE underpass_event ADD CONSTRAINT fk_event_underpass FOREIGN KEY (underpass_id) REFERENCES underpass(id);
ALTER TABLE underpass_event ADD CONSTRAINT fk_event_operator FOREIGN KEY (operator_id) REFERENCES manager(id);

ALTER TABLE alert_log ADD CONSTRAINT fk_alert_event FOREIGN KEY (event_id) REFERENCES underpass_event(id);
-- (FK 해제) 고객/차량 삭제와 무관하게 로그를 보존하기 위해 car/customer 참조 FK를 두지 않음: fk_alert_customer
-- (FK 해제) 고객/차량 삭제와 무관하게 로그를 보존하기 위해 car/customer 참조 FK를 두지 않음: fk_alert_car

ALTER TABLE display_log ADD CONSTRAINT fk_display_underpass FOREIGN KEY (underpass_id) REFERENCES underpass(id);
ALTER TABLE display_log ADD CONSTRAINT fk_display_operator FOREIGN KEY (operator_id) REFERENCES manager(id);

ALTER TABLE risk_score ADD CONSTRAINT fk_risk_underpass FOREIGN KEY (underpass_id) REFERENCES underpass(id);

ALTER TABLE threshold ADD CONSTRAINT fk_threshold_underpass FOREIGN KEY (underpass_id) REFERENCES underpass(id);
ALTER TABLE threshold ADD CONSTRAINT fk_threshold_updated FOREIGN KEY (updated_by) REFERENCES manager(id);

ALTER TABLE threshold_history ADD CONSTRAINT fk_thistory_threshold FOREIGN KEY (threshold_id) REFERENCES threshold(id);
ALTER TABLE threshold_history ADD CONSTRAINT fk_thistory_changed FOREIGN KEY (changed_by) REFERENCES manager(id);

ALTER TABLE notice ADD CONSTRAINT fk_notice_author FOREIGN KEY (author_id) REFERENCES manager(id);

ALTER TABLE notice_attachment ADD CONSTRAINT fk_nattach_notice FOREIGN KEY (notice_id) REFERENCES notice(id);

ALTER TABLE faq ADD CONSTRAINT fk_faq_author FOREIGN KEY (author_id) REFERENCES manager(id);

ALTER TABLE faq_attachment ADD CONSTRAINT fk_fattach_faq FOREIGN KEY (faq_id) REFERENCES faq(id);

ALTER TABLE inquiry ADD CONSTRAINT fk_inquiry_parent FOREIGN KEY (parent_id) REFERENCES inquiry(id);
CREATE UNIQUE INDEX uq_inquiry_parent_id_active ON inquiry (parent_id) WHERE is_deleted = FALSE; -- 답글은 살아있는 것 기준 1개만 허용(삭제된 답변은 제외하고 새 답변 가능)
ALTER TABLE inquiry ADD CONSTRAINT fk_inquiry_customer FOREIGN KEY (customer_id) REFERENCES customer(id);
ALTER TABLE inquiry ADD CONSTRAINT fk_inquiry_author FOREIGN KEY (author_manager_id) REFERENCES manager(id);

ALTER TABLE inquiry_attachment ADD CONSTRAINT fk_iattach_inquiry FOREIGN KEY (inquiry_id) REFERENCES inquiry(id);


-- 6. weather_hourly: 조회 시점 NOW() 기준으로 매번 계산되는 VIEW (테이블 아님, 시드 불필요)
--    [데모용] 서울 = 폭우 / 부산 = 약한 비 / 나머지 7개 지역 = 비 없음(맑음)
--    칸(1시간 행) 하나가 실제로는 10분마다 다음 값으로 넘어감 → 위험도가 10분 단위로 움직임
--      서울 강수 mm 순서 : 6,15,25,12 | 0,0 | 4,14,22,18,6,0  (칸당 10분 → 2시간 주기)
--      Spring이 읽는 '직전 1h/3h/6h/12h/24h' 행들이 곧 직전 10분/30분/1시간/2시간/4시간처럼 움직임
--    조절:  600(초) = 한 칸 길이 (300=5분, 900=15분, 3600=실제 1시간)
--           factor = 지역별 비의 세기 (서울 1.0, 부산 0.4, 그 외 0 → 맑음)
--           off    = 지역별 패턴 시작 위치(서울과 부산이 서로 다른 타이밍으로 움직이게 함)
CREATE VIEW weather_hourly AS
SELECT
    row_number() OVER (ORDER BY w.area_id, w.target_at) AS id,
    w.area_id,
    w.target_at,
    w.t > 0 AS is_forecast,
    CASE WHEN w.rain > 0 THEN '비'
         WHEN w.prob >= 50 THEN '흐림'
         WHEN w.prob >= 25 THEN '구름많음'
         ELSE '맑음' END AS condition,
    round((w.base_temp
           + 5 * sin(2 * pi() * (extract(hour FROM w.target_at) - 9) / 24)
           + 2 * sin(w.t / 24.0 * 1.3 + w.area_id)
           - least(3, w.rain * 0.15))::numeric, 1) AS temperature_c,
    least(98, greatest(30, (62 - 15 * sin(2 * pi() * (extract(hour FROM w.target_at) - 9) / 24)
                            + least(30, w.rain * 2) + w.prob * 0.15)::int)) AS humidity_pct,
    w.rain AS rainfall_mm,
    CASE WHEN w.t > 0 THEN w.prob END AS precipitation_prob
  FROM (
        SELECT a.id AS area_id, t,
               date_trunc('hour', NOW() AT TIME ZONE 'Asia/Seoul') + t * interval '1 hour' AS target_at,
               x.rain,
               CASE WHEN x.rain > 0 THEN least(95, 60 + (x.rain * 2)::int)
                    WHEN a.name IN ('서울', '부산')
                         THEN ((hashtext(a.name || t) & 2147483647) % 3) * 10
                            + ((hashtext(a.name || 'd' || floor((t + 24) / 24.0)) & 2147483647) % 3) * 10
                    ELSE ((hashtext(a.name || t) & 2147483647) % 3) * 5   -- 나머지 지역: 0~10% (쨍쨍)
                    END AS prob,
               CASE a.name WHEN '제주' THEN 24 WHEN '부산' THEN 23 WHEN '울산' THEN 23
                           WHEN '광주' THEN 22 WHEN '대구' THEN 22 WHEN '대전' THEN 21
                           WHEN '세종' THEN 21 ELSE 20 END AS base_temp
          FROM weather_area a
         CROSS JOIN generate_series(-24, 168) AS t
         CROSS JOIN LATERAL (
               SELECT round(greatest(0,
                        (ARRAY[6,15,25,12,0,0,4,14,22,18,6,0])[((floor(extract(epoch FROM NOW()) / 600)::int + t - o.off) % 12 + 12) % 12 + 1] * o.factor
                      )::numeric, 1) AS rain
                  FROM (SELECT CASE a.name WHEN '서울' THEN 0 WHEN '부산' THEN 6 ELSE 0 END AS off,
                               CASE a.name WHEN '서울' THEN 1.0 WHEN '부산' THEN 0.4 ELSE 0 END AS factor) o
         ) x
       ) w;

-- 7. 필수 기준행 (시드 데이터가 아니라 서비스 로직이 참조하는 고정 행)
-- 지역 삭제 시 소속 underpass/manager를 옮겨두는 특수 지역. 서비스 로직에서 삭제 금지 처리 필요.
INSERT INTO region (name) VALUES ('미배정');

