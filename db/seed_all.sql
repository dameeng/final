-- =====================================================================
-- PUF 더미 데이터 시드 (seed_all.sql)
-- 실행 전제: puf_db_schema_v3.sql 실행 완료 (region id=1 '미배정' 존재)
-- 실행 순서: FK 의존성 순서대로 정렬됨, 위에서 아래로 순서대로 실행
-- 비밀번호: 모든 계정의 비밀번호 = 로그인 아이디 (BCrypt 해시)
-- 지역: 부산광역시 16개 구/군
-- =====================================================================

-- =====================================================================
-- 0. 스키마 보정 (delivery_status에 PENDING 추가)
-- =====================================================================
ALTER TYPE delivery_status ADD VALUE IF NOT EXISTS 'PENDING' BEFORE 'SUCCESS';

-- =====================================================================
-- 1. region — 부산 16개 구/군 (id=1 '미배정'은 schema에서 이미 삽입)
-- =====================================================================
INSERT INTO region (name) VALUES
('중구'), ('서구'), ('동구'), ('영도구'),
('부산진구'), ('동래구'), ('남구'), ('북구'),
('해운대구'), ('사하구'), ('금정구'), ('강서구'),
('연제구'), ('수영구'), ('사상구'), ('기장군');

-- =====================================================================
-- 2. shift — 3교대
-- =====================================================================
INSERT INTO shift (name, start_time, end_time) VALUES
('주간조', '07:00', '15:00'),
('오후조', '15:00', '23:00'),
('야간조', '23:00', '07:00');

-- =====================================================================
-- 3. employee — 관리자 가입 대조용 직원 16명
-- =====================================================================
INSERT INTO employee (name, birth, phone, email) VALUES
('김민수', '1985-03-15', '010-1001-0001', 'minsu.kim@puf.go.kr'),
('이정호', '1988-07-22', '010-1001-0002', 'jungho.lee@puf.go.kr'),
('박서연', '1990-11-08', '010-1001-0003', 'seoyeon.park@puf.go.kr'),
('최영진', '1983-01-30', '010-1001-0004', 'youngjin.choi@puf.go.kr'),
('정다은', '1992-05-14', '010-1001-0005', 'daeun.jung@puf.go.kr'),
('강현우', '1987-09-03', '010-1001-0006', 'hyunwoo.kang@puf.go.kr'),
('조은지', '1991-12-25', '010-1001-0007', 'eunji.cho@puf.go.kr'),
('윤태현', '1986-06-11', '010-1001-0008', 'taehyun.yoon@puf.go.kr'),
('장수진', '1989-02-28', '010-1001-0009', 'sujin.jang@puf.go.kr'),
('한성민', '1984-08-19', '010-1001-0010', 'sungmin.han@puf.go.kr'),
('오지현', '1993-04-07', '010-1001-0011', 'jihyun.oh@puf.go.kr'),
('서동욱', '1982-10-16', '010-1001-0012', 'dongwook.seo@puf.go.kr'),
('신미래', '1994-07-01', '010-1001-0013', 'mirae.shin@puf.go.kr'),
('임재현', '1988-03-24', '010-1001-0014', 'jaehyun.lim@puf.go.kr'),
('홍유진', '1990-09-30', '010-1001-0015', 'yujin.hong@puf.go.kr'),
('배준혁', '1986-01-12', '010-1001-0016', 'junhyuk.bae@puf.go.kr');

-- =====================================================================
-- 4. manager — 관리자 16명 (login_id = manager01~16, pw = login_id)
--    shift_id 라운드로빈 배정: 주간(1)/오후(2)/야간(3)
-- =====================================================================
INSERT INTO manager (employee_id, login_id, password, role, status, shift_id, created_at, approved_at) VALUES
( 1, 'manager01', '$2b$10$YVcnMpDqdBOciu1Q/Tu88uG61UCj2FYl0m9borTia/JvI2Fjs/2lO', 'REGIONAL_ADMIN', 'ACTIVE', 1, NOW() - INTERVAL '90 days', NOW() - INTERVAL '89 days'),
( 2, 'manager02', '$2b$10$rszJYERxjKPglGms0NV3UefUNjkBpvweZwOkmhQX1/DHoyaEG.c/u', 'REGIONAL_ADMIN', 'ACTIVE', 2, NOW() - INTERVAL '88 days', NOW() - INTERVAL '87 days'),
( 3, 'manager03', '$2b$10$iFVuXNTQTBY1BM6YAX8FaeVEDI2r8gUGhradt3OfsoCzdY3aNjEFK', 'REGIONAL_ADMIN', 'ACTIVE', 3, NOW() - INTERVAL '86 days', NOW() - INTERVAL '85 days'),
( 4, 'manager04', '$2b$10$OAiR2nu0JnXdFA/K/DCfT.FzHaK7HtURtvmrXd5gYmMTvtMVd0O.a', 'REGIONAL_ADMIN', 'ACTIVE', 1, NOW() - INTERVAL '84 days', NOW() - INTERVAL '83 days'),
( 5, 'manager05', '$2b$10$jiSe.7MXDwv0dDoSXLbJPOVkEOJe/DCsDMwABRwkMTptrnnskJ222', 'REGIONAL_ADMIN', 'ACTIVE', 2, NOW() - INTERVAL '82 days', NOW() - INTERVAL '81 days'),
( 6, 'manager06', '$2b$10$pxrhhv7KixcEGbfChpYh4e2hoiYHiGKhmJrqetF7.cFiPMP4qA/CO', 'REGIONAL_ADMIN', 'ACTIVE', 3, NOW() - INTERVAL '80 days', NOW() - INTERVAL '79 days'),
( 7, 'manager07', '$2b$10$TMvgfEYHJVicRReQzPatnunOSl4dQgq9cbm0vLe8TPlpjHs1WlTfC', 'REGIONAL_ADMIN', 'ACTIVE', 1, NOW() - INTERVAL '78 days', NOW() - INTERVAL '77 days'),
( 8, 'manager08', '$2b$10$zskAKQFC9lHoJGxkxVLJt.nPeQSd4Xzg5tb6w4nFRRng24pEe47.m', 'REGIONAL_ADMIN', 'ACTIVE', 2, NOW() - INTERVAL '76 days', NOW() - INTERVAL '75 days'),
( 9, 'manager09', '$2b$10$RrR/hKatHquTZIKr9VptNO1F10IkAk/4IBPLnItOxkPayvlAXGlhC', 'REGIONAL_ADMIN', 'ACTIVE', 3, NOW() - INTERVAL '74 days', NOW() - INTERVAL '73 days'),
(10, 'manager10', '$2b$10$SscHgF9ejzoic.WgpKjzVexk2KPfGDtsfeqrUzyUDQ6Tdvzdc93ay', 'REGIONAL_ADMIN', 'ACTIVE', 1, NOW() - INTERVAL '72 days', NOW() - INTERVAL '71 days'),
(11, 'manager11', '$2b$10$jlA0d0.o14btHowH8l0BFeP/WV0A6w.Y/G/6NKfv/CXX6s8kzjSHK', 'REGIONAL_ADMIN', 'ACTIVE', 2, NOW() - INTERVAL '70 days', NOW() - INTERVAL '69 days'),
(12, 'manager12', '$2b$10$LcF/F2qkQ33TG77HNlbkdu4QzG99stVSRCCzfOCTYulYU7KFMhpTC', 'REGIONAL_ADMIN', 'ACTIVE', 3, NOW() - INTERVAL '68 days', NOW() - INTERVAL '67 days'),
(13, 'manager13', '$2b$10$4ed.kjxpmFllEClbhql1keiNlLKaLMbzvTqffb8Le6Lr.RiMkb/e6', 'REGIONAL_ADMIN', 'ACTIVE', 1, NOW() - INTERVAL '66 days', NOW() - INTERVAL '65 days'),
(14, 'manager14', '$2b$10$DxuFOeuWUsIhwPnhSbfvOeqm9xMwcU8w5/.MAkU9jZ55SkLnmDs8W', 'REGIONAL_ADMIN', 'ACTIVE', 2, NOW() - INTERVAL '64 days', NOW() - INTERVAL '63 days'),
(15, 'manager15', '$2b$10$XaYbw0yGnsNwvoo/3WVd9uCtYK.Emaki8KqNE2ftlfIWhav4PRqmC', 'REGIONAL_ADMIN', 'ACTIVE', 3, NOW() - INTERVAL '62 days', NOW() - INTERVAL '61 days'),
(16, 'manager16', '$2b$10$gfVtN56C6J0HJ8QFxctL/.qPkMqfuZGL7JW0HBOC4l1eUswIG5z7y', 'REGIONAL_ADMIN', 'ACTIVE', 1, NOW() - INTERVAL '60 days', NOW() - INTERVAL '59 days');

-- =====================================================================
-- 5. manager_region — 관리자 ↔ 지역 매핑 (1:1 기본, 일부 관리자 복수 지역)
--    region id: 미배정=1, 중구=2, 서구=3, 동구=4, 영도구=5, 부산진구=6,
--    동래구=7, 남구=8, 북구=9, 해운대구=10, 사하구=11, 금정구=12,
--    강서구=13, 연제구=14, 수영구=15, 사상구=16, 기장군=17
-- =====================================================================
INSERT INTO manager_region (manager_id, region_id) VALUES
(1, 2), (2, 3), (3, 4), (4, 5),
(5, 6), (6, 7), (7, 8), (8, 9),
(9, 10), (10, 11), (11, 12), (12, 13),
(13, 14), (14, 15), (15, 16), (16, 17),
-- 인접 지역 겸임 (실무에서 흔한 케이스)
(1, 3),   -- manager01: 중구 + 서구
(9, 15);  -- manager09: 해운대구 + 수영구

-- =====================================================================
-- 6. customer — 고객 10명 (login_id = customer01~10, pw = login_id)
-- =====================================================================
INSERT INTO customer (login_id, password, name, birth, email, phone, zipcode, road_addr, detail_addr, emergency, is_withdrawn, created_at) VALUES
('customer01', '$2b$10$f7pNPQHzg6AvUlBaBfvUeuWGv6A9c8TA6LR8ZAYlZLCi04h2LnnXi', '이하은', '1995-04-12', 'haeun@example.com',   '010-2001-0001', '48058', '부산 해운대구 해운대로 570',      '1201호', '010-9001-0001', FALSE, NOW() - INTERVAL '60 days'),
('customer02', '$2b$10$X84N0W6aE27uJ37Qv278N.LbVtBMSxcGN1g398ViRe7shu5nJCFBS', '김도윤', '1998-08-23', 'doyun@example.com',   '010-2001-0002', '47254', '부산 부산진구 중앙대로 672',      '301호',  '010-9001-0002', FALSE, NOW() - INTERVAL '55 days'),
('customer03', '$2b$10$jvtXtDbYafu1HPRBTHZNeezv8tcb5NpHhXVS0hBXCFnWzY/4oADXG', '박지민', '1992-01-05', 'jimin@example.com',   '010-2001-0003', '48792', '부산 동래구 충렬대로 238',        '502호',  NULL,            FALSE, NOW() - INTERVAL '50 days'),
('customer04', '$2b$10$PlrKiGmrg/WnWc/0ZPfPpuLdNoj83C45F36.R/7uzcMqda5PO0S4W', '정예준', '1990-06-17', 'yejun@example.com',   '010-2001-0004', '46726', '부산 강서구 녹산산업중로 333',    NULL,     '010-9001-0004', FALSE, NOW() - INTERVAL '45 days'),
('customer05', '$2b$10$dAxj1t1KP8AXE78/MXu3b.wnYKHtYhcWP7QjS94vbF7UA5w1MX9C.', '최서아', '1997-11-30', NULL,                  '010-2001-0005', '48267', '부산 수영구 광안해변로 219',      '702호',  NULL,            FALSE, NOW() - INTERVAL '40 days'),
('customer06', '$2b$10$864KglWTKZLl2Oe7OFo7uO069WKEQCtcLdaztTinTwozIslkndsA6', '강민재', '1988-03-09', 'minjae@example.com',  '010-2001-0006', '49236', '부산 사하구 낙동대로 398',        '203호',  '010-9001-0006', FALSE, NOW() - INTERVAL '35 days'),
('customer07', '$2b$10$7ASBqdB9N10Yz1Ot5D2.xOF/OO1cAEz4g20QLUQ4NO5bmSXHTWsh6', '조하윤', '1999-09-14', 'hayun@example.com',   '010-2001-0007', '46241', '부산 금정구 금정로 63',           '101호',  NULL,            FALSE, NOW() - INTERVAL '30 days'),
('customer08', '$2b$10$Y6AeEQ.Ieu8gvABl/pe5ve3s9ew8xtSiObmDWWKQ0JB/HIta4Pxvq', '윤시우', '1993-12-01', 'siwoo@example.com',   '010-2001-0008', '47545', '부산 연제구 연제로 2',            '805호',  '010-9001-0008', FALSE, NOW() - INTERVAL '25 days'),
('customer09', '$2b$10$zGsSHPqwOjDzIN3ozBtdvuIY6uTYV2Zms41Hvxqb6VPHM1/s5Q2/u', '장소율', '1996-05-20', NULL,                  '010-2001-0009', '46079', '부산 중구 중앙대로 2',            NULL,     NULL,            FALSE, NOW() - INTERVAL '20 days'),
('customer10', '$2b$10$u45mUGuoLrd2qkzKSipX.u7/y0ZmpVKO0MarPJ79K5KeDcmv75ieW', '한유찬', '1985-07-08', 'yuchan@example.com',  '010-2001-0010', '48311', '부산 사상구 사상로 310',          '1502호', '010-9001-0010', FALSE, NOW() - INTERVAL '15 days');

-- =====================================================================
-- 7. car — 고객 등록 차량 (고객당 1~2대)
-- =====================================================================
INSERT INTO car (customer_id, car_num) VALUES
(1, '51허 3927'), (1, '12가 7841'),
(2, '23나 5012'),
(3, '67다 8834'), (3, '34가 2019'),
(4, '45라 1156'),
(5, '78마 6623'),
(6, '56바 4490'), (6, '89사 7712'),
(7, '91아 3345'),
(8, '32자 8867'),
(9, '64차 5501'), (9, '17카 9923'),
(10, '73타 2278');

-- =====================================================================
-- 8. underpass — 부산 지하차도 8개소 (카메라 참조는 나중에 UPDATE)
-- =====================================================================
INSERT INTO underpass (name, region_id, road_addr, lat, lng, height, length, width, water_dist, flood_count) VALUES
('범일로 지하차도',   4,  '부산 동구 범일로 120',         35.1400, 129.0560, 5.20, 320.00, 12.00, 850.00,  2),
('대연로 지하차도',   8,  '부산 남구 대연로 45',          35.1350, 129.0850, 4.80, 280.00, 10.50, 1200.00, 1),
('사직로 지하차도',   7,  '부산 동래구 사직로 98',        35.1950, 129.0700, 5.50, 350.00, 13.00, 600.00,  3),
('만덕로 지하차도',   9,  '부산 북구 만덕대로 155',       35.2100, 129.0150, 4.50, 260.00, 11.00, 950.00,  1),
('좌동로 지하차도',   10, '부산 해운대구 좌동순환로 85',  35.1700, 129.1750, 5.00, 300.00, 12.50, 500.00,  4),
('괴정로 지하차도',   11, '부산 사하구 괴정로 63',        35.1000, 128.9700, 4.60, 240.00, 10.00, 700.00,  2),
('구서로 지하차도',   12, '부산 금정구 구서로 27',        35.2450, 129.0900, 5.30, 310.00, 11.50, 1100.00, 0),
('거제로 지하차도',   14, '부산 연제구 거제대로 178',     35.1750, 129.0750, 4.90, 290.00, 12.00, 800.00,  1);

-- =====================================================================
-- 9. camera — 지하차도별 카메라 5대 (CCTV 1 + LPR 4)
--    순서: 지하차도 1~8 × (상행입구, 상행출구, 하행입구, 하행출구, CCTV)
-- =====================================================================
INSERT INTO camera (underpass_id, role, stream_url, dist, lat, lng) VALUES
-- 범일로 지하차도 (underpass 1)
(1, 'APPROACH_LPR', 'rtsp://cam01.puf.local/stream', 200, 35.1410, 129.0555),
(1, 'FINAL_LPR',    'rtsp://cam02.puf.local/stream', 50,  35.1405, 129.0558),
(1, 'APPROACH_LPR', 'rtsp://cam03.puf.local/stream', 200, 35.1390, 129.0565),
(1, 'FINAL_LPR',    'rtsp://cam04.puf.local/stream', 50,  35.1395, 129.0562),
(1, 'CCTV',         'rtsp://cam05.puf.local/stream', NULL, 35.1400, 129.0560),
-- 대연로 지하차도 (underpass 2)
(2, 'APPROACH_LPR', 'rtsp://cam06.puf.local/stream', 180, 35.1360, 129.0845),
(2, 'FINAL_LPR',    'rtsp://cam07.puf.local/stream', 40,  35.1355, 129.0848),
(2, 'APPROACH_LPR', 'rtsp://cam08.puf.local/stream', 180, 35.1340, 129.0855),
(2, 'FINAL_LPR',    'rtsp://cam09.puf.local/stream', 40,  35.1345, 129.0852),
(2, 'CCTV',         'rtsp://cam10.puf.local/stream', NULL, 35.1350, 129.0850),
-- 사직로 지하차도 (underpass 3)
(3, 'APPROACH_LPR', 'rtsp://cam11.puf.local/stream', 220, 35.1960, 129.0695),
(3, 'FINAL_LPR',    'rtsp://cam12.puf.local/stream', 45,  35.1955, 129.0698),
(3, 'APPROACH_LPR', 'rtsp://cam13.puf.local/stream', 220, 35.1940, 129.0705),
(3, 'FINAL_LPR',    'rtsp://cam14.puf.local/stream', 45,  35.1945, 129.0702),
(3, 'CCTV',         'rtsp://cam15.puf.local/stream', NULL, 35.1950, 129.0700),
-- 만덕로 지하차도 (underpass 4)
(4, 'APPROACH_LPR', 'rtsp://cam16.puf.local/stream', 190, 35.2110, 129.0145),
(4, 'FINAL_LPR',    'rtsp://cam17.puf.local/stream', 50,  35.2105, 129.0148),
(4, 'APPROACH_LPR', 'rtsp://cam18.puf.local/stream', 190, 35.2090, 129.0155),
(4, 'FINAL_LPR',    'rtsp://cam19.puf.local/stream', 50,  35.2095, 129.0152),
(4, 'CCTV',         'rtsp://cam20.puf.local/stream', NULL, 35.2100, 129.0150),
-- 좌동로 지하차도 (underpass 5)
(5, 'APPROACH_LPR', 'rtsp://cam21.puf.local/stream', 210, 35.1710, 129.1745),
(5, 'FINAL_LPR',    'rtsp://cam22.puf.local/stream', 55,  35.1705, 129.1748),
(5, 'APPROACH_LPR', 'rtsp://cam23.puf.local/stream', 210, 35.1690, 129.1755),
(5, 'FINAL_LPR',    'rtsp://cam24.puf.local/stream', 55,  35.1695, 129.1752),
(5, 'CCTV',         'rtsp://cam25.puf.local/stream', NULL, 35.1700, 129.1750),
-- 괴정로 지하차도 (underpass 6)
(6, 'APPROACH_LPR', 'rtsp://cam26.puf.local/stream', 170, 35.1010, 128.9695),
(6, 'FINAL_LPR',    'rtsp://cam27.puf.local/stream', 35,  35.1005, 128.9698),
(6, 'APPROACH_LPR', 'rtsp://cam28.puf.local/stream', 170, 35.0990, 128.9705),
(6, 'FINAL_LPR',    'rtsp://cam29.puf.local/stream', 35,  35.0995, 128.9702),
(6, 'CCTV',         'rtsp://cam30.puf.local/stream', NULL, 35.1000, 128.9700),
-- 구서로 지하차도 (underpass 7)
(7, 'APPROACH_LPR', 'rtsp://cam31.puf.local/stream', 200, 35.2460, 129.0895),
(7, 'FINAL_LPR',    'rtsp://cam32.puf.local/stream', 50,  35.2455, 129.0898),
(7, 'APPROACH_LPR', 'rtsp://cam33.puf.local/stream', 200, 35.2440, 129.0905),
(7, 'FINAL_LPR',    'rtsp://cam34.puf.local/stream', 50,  35.2445, 129.0902),
(7, 'CCTV',         'rtsp://cam35.puf.local/stream', NULL, 35.2450, 129.0900),
-- 거제로 지하차도 (underpass 8)
(8, 'APPROACH_LPR', 'rtsp://cam36.puf.local/stream', 185, 35.1760, 129.0745),
(8, 'FINAL_LPR',    'rtsp://cam37.puf.local/stream', 45,  35.1755, 129.0748),
(8, 'APPROACH_LPR', 'rtsp://cam38.puf.local/stream', 185, 35.1740, 129.0755),
(8, 'FINAL_LPR',    'rtsp://cam39.puf.local/stream', 45,  35.1745, 129.0752),
(8, 'CCTV',         'rtsp://cam40.puf.local/stream', NULL, 35.1750, 129.0750);

-- =====================================================================
-- 10. underpass 카메라 참조 UPDATE
--     카메라 ID 배치: 지하차도 N → 카메라 (N-1)*5 + 1 ~ (N-1)*5 + 5
--     순서: 상행입구(1), 상행출구(2), 하행입구(3), 하행출구(4), CCTV(5)
-- =====================================================================
UPDATE underpass SET up_entry_cam_id = 1,  up_exit_cam_id = 2,  down_entry_cam_id = 3,  down_exit_cam_id = 4  WHERE id = 1;
UPDATE underpass SET up_entry_cam_id = 6,  up_exit_cam_id = 7,  down_entry_cam_id = 8,  down_exit_cam_id = 9  WHERE id = 2;
UPDATE underpass SET up_entry_cam_id = 11, up_exit_cam_id = 12, down_entry_cam_id = 13, down_exit_cam_id = 14 WHERE id = 3;
UPDATE underpass SET up_entry_cam_id = 16, up_exit_cam_id = 17, down_entry_cam_id = 18, down_exit_cam_id = 19 WHERE id = 4;
UPDATE underpass SET up_entry_cam_id = 21, up_exit_cam_id = 22, down_entry_cam_id = 23, down_exit_cam_id = 24 WHERE id = 5;
UPDATE underpass SET up_entry_cam_id = 26, up_exit_cam_id = 27, down_entry_cam_id = 28, down_exit_cam_id = 29 WHERE id = 6;
UPDATE underpass SET up_entry_cam_id = 31, up_exit_cam_id = 32, down_entry_cam_id = 33, down_exit_cam_id = 34 WHERE id = 7;
UPDATE underpass SET up_entry_cam_id = 36, up_exit_cam_id = 37, down_entry_cam_id = 38, down_exit_cam_id = 39 WHERE id = 8;

-- =====================================================================
-- 11. pm_equipment — 지하차도별 설비 (CCTV 1 + DISPLAY 1 + PUMP 1)
--     equip_id 배치: 지하차도 N → (N-1)*3 + 1(CCTV), +2(DISPLAY), +3(PUMP)
-- =====================================================================
INSERT INTO pm_equipment (underpass_id, type, cam_id) VALUES
(1, 'CCTV', 5),  (1, 'DISPLAY', NULL), (1, 'PUMP', NULL),
(2, 'CCTV', 10), (2, 'DISPLAY', NULL), (2, 'PUMP', NULL),
(3, 'CCTV', 15), (3, 'DISPLAY', NULL), (3, 'PUMP', NULL),
(4, 'CCTV', 20), (4, 'DISPLAY', NULL), (4, 'PUMP', NULL),
(5, 'CCTV', 25), (5, 'DISPLAY', NULL), (5, 'PUMP', NULL),
(6, 'CCTV', 30), (6, 'DISPLAY', NULL), (6, 'PUMP', NULL),
(7, 'CCTV', 35), (7, 'DISPLAY', NULL), (7, 'PUMP', NULL),
(8, 'CCTV', 40), (8, 'DISPLAY', NULL), (8, 'PUMP', NULL);

-- =====================================================================
-- 12. threshold — 지하차도별 위험도 임계치 (안전 0 / 주의 40 / 위험 70)
-- =====================================================================
INSERT INTO threshold (underpass_id, level, min_score, updated_by) VALUES
(1, '안전', 0,  1), (1, '주의', 40, 1), (1, '위험', 70, 1),
(2, '안전', 0,  7), (2, '주의', 40, 7), (2, '위험', 70, 7),
(3, '안전', 0,  6), (3, '주의', 40, 6), (3, '위험', 70, 6),
(4, '안전', 0,  8), (4, '주의', 40, 8), (4, '위험', 70, 8),
(5, '안전', 0,  9), (5, '주의', 40, 9), (5, '위험', 70, 9),
(6, '안전', 0, 10), (6, '주의', 40, 10), (6, '위험', 70, 10),
(7, '안전', 0, 11), (7, '주의', 40, 11), (7, '위험', 70, 11),
(8, '안전', 0, 13), (8, '주의', 40, 13), (8, '위험', 70, 13);

-- =====================================================================
-- 13. pm_threshold — 설비별 예지보전 임계치 (안전 0 / 주의 50 / 위험 80)
--     DISPLAY(equip 2,5,8,...) 와 PUMP(equip 3,6,9,...) 에만 적용
--     CCTV는 recognition_rate 기반이므로 별도 기준
-- =====================================================================
INSERT INTO pm_threshold (equip_id, level, min_score, updated_by) VALUES
-- CCTV (equip 1,4,7,10,13,16,19,22) — 안전 0 / 주의 40 / 위험 65
(1,  '안전', 0, 1), (1,  '주의', 40, 1), (1,  '위험', 65, 1),
(4,  '안전', 0, 7), (4,  '주의', 40, 7), (4,  '위험', 65, 7),
(7,  '안전', 0, 6), (7,  '주의', 40, 6), (7,  '위험', 65, 6),
(10, '안전', 0, 8), (10, '주의', 40, 8), (10, '위험', 65, 8),
(13, '안전', 0, 9), (13, '주의', 40, 9), (13, '위험', 65, 9),
(16, '안전', 0, 10),(16, '주의', 40, 10),(16, '위험', 65, 10),
(19, '안전', 0, 11),(19, '주의', 40, 11),(19, '위험', 65, 11),
(22, '안전', 0, 13),(22, '주의', 40, 13),(22, '위험', 65, 13),
-- DISPLAY (equip 2,5,8,11,14,17,20,23) — 안전 0 / 주의 50 / 위험 80
(2,  '안전', 0, 1), (2,  '주의', 50, 1), (2,  '위험', 80, 1),
(5,  '안전', 0, 7), (5,  '주의', 50, 7), (5,  '위험', 80, 7),
(8,  '안전', 0, 6), (8,  '주의', 50, 6), (8,  '위험', 80, 6),
(11, '안전', 0, 8), (11, '주의', 50, 8), (11, '위험', 80, 8),
(14, '안전', 0, 9), (14, '주의', 50, 9), (14, '위험', 80, 9),
(17, '안전', 0, 10),(17, '주의', 50, 10),(17, '위험', 80, 10),
(20, '안전', 0, 11),(20, '주의', 50, 11),(20, '위험', 80, 11),
(23, '안전', 0, 13),(23, '주의', 50, 13),(23, '위험', 80, 13),
-- PUMP (equip 3,6,9,12,15,18,21,24) — 안전 0 / 주의 45 / 위험 75
(3,  '안전', 0, 1), (3,  '주의', 45, 1), (3,  '위험', 75, 1),
(6,  '안전', 0, 7), (6,  '주의', 45, 7), (6,  '위험', 75, 7),
(9,  '안전', 0, 6), (9,  '주의', 45, 6), (9,  '위험', 75, 6),
(12, '안전', 0, 8), (12, '주의', 45, 8), (12, '위험', 75, 8),
(15, '안전', 0, 9), (15, '주의', 45, 9), (15, '위험', 75, 9),
(18, '안전', 0, 10),(18, '주의', 45, 10),(18, '위험', 75, 10),
(21, '안전', 0, 11),(21, '주의', 45, 11),(21, '위험', 75, 11),
(24, '안전', 0, 13),(24, '주의', 45, 13),(24, '위험', 75, 13);

-- =====================================================================
-- 14. weather_area — 부산 16개 구/군 중심 좌표
-- =====================================================================
INSERT INTO weather_area (name, lat, lng) VALUES
('중구',     35.1060, 129.0324),
('서구',     35.0975, 129.0241),
('동구',     35.1297, 129.0457),
('영도구',   35.0911, 129.0679),
('부산진구', 35.1629, 129.0532),
('동래구',   35.2048, 129.0838),
('남구',     35.1367, 129.0843),
('북구',     35.1970, 128.9901),
('해운대구', 35.1631, 129.1636),
('사하구',   35.1041, 128.9745),
('금정구',   35.2428, 129.0916),
('강서구',   35.2121, 128.9802),
('연제구',   35.1762, 129.0795),
('수영구',   35.1457, 129.1133),
('사상구',   35.1524, 128.9910),
('기장군',   35.2447, 129.2225);

-- =====================================================================
-- 15. reason_preset — 사유 프리셋 10건
-- =====================================================================
INSERT INTO reason_preset (content) VALUES
('집중호우로 인한 수위 상승'),
('태풍 접근에 따른 사전 차단'),
('배수펌프 고장으로 인한 침수 위험'),
('하천 범람 경보 발령'),
('도로 결빙 위험'),
('시설물 긴급 점검'),
('공사로 인한 임시 차단'),
('수위 안정화에 따른 해제'),
('기상 호전에 따른 해제'),
('점검 완료 후 정상 개통');

-- =====================================================================
-- 16. display_preset — 전광판 프리셋 (단계별 1건씩, 총 5건)
-- =====================================================================
INSERT INTO display_preset (category, content) VALUES
('SAFE',    '안전 — 통행 가능합니다'),
('WARNING', '주의 — 수위 상승 중, 서행하세요'),
('DANGER',  '위험 — 수위 위험, 우회하세요'),
('BLOCK',   '차단 — 통행 금지, 우회도로 이용'),
('RELEASE', '해제 — 통행이 재개되었습니다');

-- =====================================================================
-- 17. faq — 자주묻는질문 5건
-- =====================================================================
INSERT INTO faq (question, answer, manager_id) VALUES
('지하차도 침수 위험 알림은 어떻게 받나요?',
 '회원가입 후 차량을 등록하시면, 해당 차량이 지하차도 부근에서 감지될 때 자동으로 알림을 받으실 수 있습니다. 웹푸시 또는 문자(SMS)로 발송됩니다.',
 1),
('차량 등록은 몇 대까지 가능한가요?',
 '등록 대수 제한은 없습니다. 가족 공유 차량의 경우, 같은 번호판을 여러 회원이 각각 등록할 수 있습니다.',
 1),
('지하차도가 차단되면 언제 해제되나요?',
 '수위가 안전 기준 이하로 내려가고, 관리자가 현장을 확인한 후 해제됩니다. 해제 시 알림을 다시 발송해 드립니다.',
 5),
('위험도 점수는 어떻게 산출되나요?',
 'AI 모델이 현재 강수량, 누적 강수량, 지하차도 구조(높이/길이/폭), 인근 하천 거리, 과거 침수 이력 등을 종합하여 0~100점으로 산출합니다.',
 6),
('예지보전이 뭔가요?',
 'CCTV, 전광판, 배수펌프 등 시설물의 고장을 사전에 예측하는 시스템입니다. 센서 데이터를 분석하여 점검이 필요한 설비를 미리 알려줍니다.',
 11);

-- =====================================================================
-- 18. notice — 공지사항 3건
-- =====================================================================
INSERT INTO notice (title, content, is_important, manager_id) VALUES
('PUF 시스템 오픈 안내',
 '부산광역시 지하차도 침수 예방 시스템(PUF)이 정식 오픈되었습니다. 차량을 등록하시면 위험 알림을 받으실 수 있습니다.',
 TRUE, 1),
('태풍 대비 사전 안내',
 '기상청 예보에 따라 이번 주말 태풍 영향이 예상됩니다. 지하차도 이용 시 각별히 주의해 주시기 바랍니다.',
 TRUE, 9),
('시스템 정기 점검 안내',
 '10월 25일(금) 02:00~06:00 시스템 정기 점검이 예정되어 있습니다. 해당 시간 동안 서비스 이용이 제한될 수 있습니다.',
 FALSE, 1);

-- =====================================================================
-- 19. chat_synonym — 챗봇 유의어 매핑
-- =====================================================================
INSERT INTO chat_synonym (keyword, synonym) VALUES
('지하차도', '언더패스'),
('지하차도', '지하도'),
('지하차도', '지하도로'),
('침수', '잠김'),
('침수', '물에 잠김'),
('차단', '통제'),
('차단', '폐쇄'),
('위험도', '위험수준'),
('위험도', '리스크'),
('전광판', '안내판'),
('전광판', '전자표지판'),
('알림', '통보'),
('알림', '경고');

-- =====================================================================
-- 20. chat_suggestion — 챗봇 추천질문
-- =====================================================================
INSERT INTO chat_suggestion (content, seq) VALUES
('현재 차단된 지하차도가 있나요?', 1),
('내 차량에 위험 알림이 온 적 있나요?', 2),
('지하차도 침수 위험 알림은 어떻게 받나요?', 3),
('위험도 점수는 어떻게 산출되나요?', 4),
('부산에서 가장 침수 위험이 높은 지하차도는?', 5);

-- =====================================================================
-- 21. device_token — 고객 푸시 토큰 (테스트용 더미)
-- =====================================================================
INSERT INTO device_token (customer_id, token, platform) VALUES
(1, 'web_token_customer01_001', 'WEB'),
(1, 'app_token_customer01_001', 'APP'),
(2, 'web_token_customer02_001', 'WEB'),
(3, 'app_token_customer03_001', 'APP'),
(4, 'web_token_customer04_001', 'WEB'),
(5, 'web_token_customer05_001', 'WEB'),
(6, 'app_token_customer06_001', 'APP'),
(7, 'web_token_customer07_001', 'WEB'),
(8, 'web_token_customer08_001', 'WEB'),
(8, 'app_token_customer08_001', 'APP'),
(9, 'web_token_customer09_001', 'WEB'),
(10, 'app_token_customer10_001', 'APP');

-- =====================================================================
-- 완료 — ID 배치 요약
-- =====================================================================
-- region:       1=미배정, 2=중구, ..., 17=기장군
-- employee:     1~16
-- shift:        1=주간, 2=오후, 3=야간
-- manager:      1~16 (login: manager01~16)
-- customer:     1~10 (login: customer01~10)
-- car:          1~14 (고객당 1~2대)
-- underpass:    1~8
-- camera:       1~40 (지하차도당 5대)
-- pm_equipment: 1~24 (지하차도당 3대: CCTV/DISPLAY/PUMP)
--   DISPLAY 설비 ID: 2, 5, 8, 11, 14, 17, 20, 23
-- threshold:    1~24 (지하차도당 3단계)
-- pm_threshold: 1~72 (설비당 3단계)
-- weather_area: 1~16 (부산 16구군)
-- reason_preset:  1~10
-- display_preset: 1~5 (SAFE/WARNING/DANGER/BLOCK/RELEASE)
-- faq:          1~5
-- notice:       1~3
-- device_token: 1~12
