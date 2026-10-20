-- =====================================================================
-- PUF 더미 데이터 시드 (seed_all.sql)
-- 실행 전제: puf_db_schema_v4.sql 실행 완료 (region id=1 '미배정' 존재, delivery_status 의 PENDING 도 스키마에 포함됨)
-- 실행 순서: FK 의존성 순서대로 정렬됨, 위에서 아래로 순서대로 실행
-- 비밀번호: 모든 계정의 비밀번호 = 로그인 아이디 (BCrypt 해시)
-- 지역: 부산광역시 16개 구/군
-- 지하차도 좌표: 현장 확인 좌표 반영본(20곳). 카메라 좌표는 지하차도 좌표에서 자동 계산됨
-- =====================================================================

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
('김민수', '1985-03-15', '01010010001', 'minsu.kim@puf.go.kr'),
('이정호', '1988-07-22', '01010010002', 'jungho.lee@puf.go.kr'),
('박서연', '1990-11-08', '01010010003', 'seoyeon.park@puf.go.kr'),
('최영진', '1983-01-30', '01010010004', 'youngjin.choi@puf.go.kr'),
('정다은', '1992-05-14', '01010010005', 'daeun.jung@puf.go.kr'),
('강현우', '1987-09-03', '01010010006', 'hyunwoo.kang@puf.go.kr'),
('조은지', '1991-12-25', '01010010007', 'eunji.cho@puf.go.kr'),
('윤태현', '1986-06-11', '01010010008', 'taehyun.yoon@puf.go.kr'),
('장수진', '1989-02-28', '01010010009', 'sujin.jang@puf.go.kr'),
('한성민', '1984-08-19', '01010010010', 'sungmin.han@puf.go.kr'),
('오지현', '1993-04-07', '01010010011', 'jihyun.oh@puf.go.kr'),
('서동욱', '1982-10-16', '01010010012', 'dongwook.seo@puf.go.kr'),
('신미래', '1994-07-01', '01010010013', 'mirae.shin@puf.go.kr'),
('임재현', '1988-03-24', '01010010014', 'jaehyun.lim@puf.go.kr'),
('홍유진', '1990-09-30', '01010010015', 'yujin.hong@puf.go.kr'),
('배준혁', '1986-01-12', '01010010016', 'junhyuk.bae@puf.go.kr');

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
('customer01', '$2b$10$f7pNPQHzg6AvUlBaBfvUeuWGv6A9c8TA6LR8ZAYlZLCi04h2LnnXi', '이하은', '1995-04-12', 'haeun@example.com',   '01020010001', '48058', '부산 해운대구 해운대로 570',      '1201호', '01090010001', FALSE, NOW() - INTERVAL '60 days'),
('customer02', '$2b$10$X84N0W6aE27uJ37Qv278N.LbVtBMSxcGN1g398ViRe7shu5nJCFBS', '김도윤', '1998-08-23', 'doyun@example.com',   '01020010002', '47254', '부산 부산진구 중앙대로 672',      '301호',  '01090010002', FALSE, NOW() - INTERVAL '55 days'),
('customer03', '$2b$10$jvtXtDbYafu1HPRBTHZNeezv8tcb5NpHhXVS0hBXCFnWzY/4oADXG', '박지민', '1992-01-05', 'jimin@example.com',   '01020010003', '48792', '부산 동래구 충렬대로 238',        '502호',  NULL,            FALSE, NOW() - INTERVAL '50 days'),
('customer04', '$2b$10$PlrKiGmrg/WnWc/0ZPfPpuLdNoj83C45F36.R/7uzcMqda5PO0S4W', '정예준', '1990-06-17', 'yejun@example.com',   '01020010004', '46726', '부산 강서구 녹산산업중로 333',    NULL,     '01090010004', FALSE, NOW() - INTERVAL '45 days'),
('customer05', '$2b$10$dAxj1t1KP8AXE78/MXu3b.wnYKHtYhcWP7QjS94vbF7UA5w1MX9C.', '최서아', '1997-11-30', NULL,                  '01020010005', '48267', '부산 수영구 광안해변로 219',      '702호',  NULL,            FALSE, NOW() - INTERVAL '40 days'),
('customer06', '$2b$10$864KglWTKZLl2Oe7OFo7uO069WKEQCtcLdaztTinTwozIslkndsA6', '강민재', '1988-03-09', 'minjae@example.com',  '01020010006', '49236', '부산 사하구 낙동대로 398',        '203호',  '01090010006', FALSE, NOW() - INTERVAL '35 days'),
('customer07', '$2b$10$7ASBqdB9N10Yz1Ot5D2.xOF/OO1cAEz4g20QLUQ4NO5bmSXHTWsh6', '조하윤', '1999-09-14', 'hayun@example.com',   '01020010007', '46241', '부산 금정구 금정로 63',           '101호',  NULL,            FALSE, NOW() - INTERVAL '30 days'),
('customer08', '$2b$10$Y6AeEQ.Ieu8gvABl/pe5ve3s9ew8xtSiObmDWWKQ0JB/HIta4Pxvq', '윤시우', '1993-12-01', 'siwoo@example.com',   '01020010008', '47545', '부산 연제구 연제로 2',            '805호',  '01090010008', FALSE, NOW() - INTERVAL '25 days'),
('customer09', '$2b$10$zGsSHPqwOjDzIN3ozBtdvuIY6uTYV2Zms41Hvxqb6VPHM1/s5Q2/u', '장소율', '1996-05-20', NULL,                  '01020010009', '46079', '부산 중구 중앙대로 2',            NULL,     NULL,            FALSE, NOW() - INTERVAL '20 days'),
('customer10', '$2b$10$u45mUGuoLrd2qkzKSipX.u7/y0ZmpVKO0MarPJ79K5KeDcmv75ieW', '한유찬', '1985-07-08', 'yuchan@example.com',  '01020010010', '48311', '부산 사상구 사상로 310',          '1502호', '01090010010', FALSE, NOW() - INTERVAL '15 days');

-- =====================================================================
-- 7. car — 고객 등록 차량 (고객당 1~2대)
-- =====================================================================
INSERT INTO car (customer_id, car_num) VALUES
(1, '51허3927'), (1, '12가7841'),
(2, '23나5012'),
(3, '67다8834'), (3, '34가2019'),
(4, '45라1156'),
(5, '78마6623'),
(6, '56바4490'), (6, '89사7712'),
(7, '91아3345'),
(8, '32자8867'),
(9, '64차5501'), (9, '17카9923'),
(10, '73타2278');

-- =====================================================================
-- 8. underpass — 부산 지하차도 45개소 (busan_underpass_master 엑셀 기준)
--    region_id는 region.name으로 조회(id 값에 의존하지 않음). 카메라 참조는 아래 10번에서 UPDATE
--    flood_count(침수 이력)는 엑셀에 없어서 기본값 0
-- =====================================================================
INSERT INTO underpass (name, region_id, road_addr, lat, lng, height, length, width, lanes, safety_grade, river_dist, sea_dist) VALUES
('금호지하차도', (SELECT id FROM region WHERE name = '강서구' AND is_deleted = FALSE), '부산광역시 강서구', 35.170616, 128.960309, 7.4, 120, 27, 6, 'B', 21.8, 6945.7),
('대상지하차도', (SELECT id FROM region WHERE name = '강서구' AND is_deleted = FALSE), '부산광역시 강서구', 35.211652, 128.973808, 4.9, 130, 16, 4, 'B', 279.4, 11790.1),
('명지동진 지하차도', (SELECT id FROM region WHERE name = '강서구' AND is_deleted = FALSE), '부산광역시 강서구', 35.097319, 128.926846, 4.8, 160, 17, 4, 'B', 211.1, 556.6),
('명지지하차도', (SELECT id FROM region WHERE name = '강서구' AND is_deleted = FALSE), '부산광역시 강서구', 35.0890275, 128.9036914, 4.5, 380, 15.5, 4, 'B', 685.4, 1485.2),
('봉림지하차도', (SELECT id FROM region WHERE name = '강서구' AND is_deleted = FALSE), '부산광역시 강서구', 35.175896, 128.900941, 7, 470, 25.5, 6, 'B', 43.9, 6008.1),
('구서 지하차도', (SELECT id FROM region WHERE name = '금정구' AND is_deleted = FALSE), '부산광역시 금정구', 35.2459875, 129.0929531, 5, 140, 17, 4, 'B', 243.7, 9400.3),
('장전지하차도', (SELECT id FROM region WHERE name = '금정구' AND is_deleted = FALSE), '부산광역시 금정구', 35.240005, 129.087363, 4.8, 220, 9.3, 4, 'B', 182, 8641.9),
('삼성1 지하차도', (SELECT id FROM region WHERE name = '기장군' AND is_deleted = FALSE), '부산광역시 기장군', 35.2660334, 129.2281624, 4.8, 368, 14, 4, 'A', 501.9, 650.4),
('대남 지하차도', (SELECT id FROM region WHERE name = '남구' AND is_deleted = FALSE), '부산광역시 남구', 35.1402331, 129.1049538, 5, 125, 16, 4, 'B', 35.3, 758.5),
('문현지하차도', (SELECT id FROM region WHERE name = '남구' AND is_deleted = FALSE), '부산광역시 남구', 35.137092, 129.068048, 10, 260, 17, 4, 'B', 124.1, 810.3),
('신선대지하차도', (SELECT id FROM region WHERE name = '남구' AND is_deleted = FALSE), '부산광역시 남구', 35.123743, 129.099580, 4.7, 1800, 14, 4, 'B', 173.9, 1181.1),
('부산진시장 지하차도', (SELECT id FROM region WHERE name = '동구' AND is_deleted = FALSE), '부산광역시 동구', 35.137087, 129.057756, 4, 44, 12, 2, 'B', 557.5, 1099.4),
('초량 제1지하차도', (SELECT id FROM region WHERE name = '동구' AND is_deleted = FALSE), '부산광역시 동구', 35.1191375, 129.0447344, 3.5, 165, 15, 2, 'B', 346.1, 397),
('초량 제2지하차도', (SELECT id FROM region WHERE name = '동구' AND is_deleted = FALSE), '부산광역시 동구', 35.1231375, 129.0469531, 3.5, 175, 15, 2, 'B', 658.2, 241.8),
('충장지하차도', (SELECT id FROM region WHERE name = '동구' AND is_deleted = FALSE), '부산광역시 동구', 35.115165, 129.043793, 7.3, 1860, 20, 4, 'UNKNOWN', 310.5, 285.4),
('내성 지하차도', (SELECT id FROM region WHERE name = '동래구' AND is_deleted = FALSE), '부산광역시 동래구', 35.2044875, 129.0780469, 4.6, 185, 17, 4, 'B', 158.1, 6145.9),
('안락 지하차도', (SELECT id FROM region WHERE name = '동래구' AND is_deleted = FALSE), '부산광역시 동래구', 35.198163, 129.096968, 4.6, 200, 15.2, 4, 'B', 611.8, 4522.4),
('우장춘 지하차도', (SELECT id FROM region WHERE name = '동래구' AND is_deleted = FALSE), '부산광역시 동래구', 35.2151375, 129.0723594, 4.6, 244, 17.6, 4, 'B', 574.1, 7360.8),
('가야감고개공원 복개구조물', (SELECT id FROM region WHERE name = '부산진구' AND is_deleted = FALSE), '부산광역시 부산진구', 35.14845892, 129.0334801, 6.5, 105, 46, 4, 'B', 166.5, 3072.4),
('문전교차로 지하차도', (SELECT id FROM region WHERE name = '부산진구' AND is_deleted = FALSE), '부산광역시 부산진구', 35.149896, 129.065352, 4.7, 436, 8, 2, 'A', 265, 2279.3),
('범일지하도', (SELECT id FROM region WHERE name = '부산진구' AND is_deleted = FALSE), '부산광역시 부산진구', 35.14489, 129.057733, 3.5, 27.7, 8, 2, 'B', 304, 1803.9),
('범천지하차도', (SELECT id FROM region WHERE name = '부산진구' AND is_deleted = FALSE), '부산광역시 부산진구', 35.1472161, 129.0558065, 4.5, 215, 16, 4, 'B', 3.8, 2111.8),
('구남 굴다리', (SELECT id FROM region WHERE name = '북구' AND is_deleted = FALSE), '부산광역시 북구', 35.203253, 128.994752, 4.1, 33, 6, 2, 'B', 129.6, 10096.9),
('만덕2터널밑지하보차도', (SELECT id FROM region WHERE name = '북구' AND is_deleted = FALSE), '부산광역시 북구', 35.2113625, 129.0513906, 4.6, 72, 9.2, 2, 'B', 662.7, 8489.7),
('만덕고개생태통로', (SELECT id FROM region WHERE name = '동래구' AND is_deleted = FALSE), '부산광역시 동래구', 35.2129012, 129.0519514, 8, 25, 8, 2, 'B', 589.5, 8552.6),
('와석지하차도', (SELECT id FROM region WHERE name = '북구' AND is_deleted = FALSE), '부산광역시 북구', 35.2354204, 129.0204082, 4.5, 480, 10, 4, 'A', 66.3, 12356.6),
('산업인력공단옆지하차도', (SELECT id FROM region WHERE name = '북구' AND is_deleted = FALSE), '부산광역시 북구', 35.2465732, 129.0096511, 5, 37, 8.6, 2, 'B', 157.8, 13900.3),
('감현2교', (SELECT id FROM region WHERE name = '사상구' AND is_deleted = FALSE), '부산광역시 사상구', 35.167548, 128.987185, 2, 20, 4.4, 2, 'B', 225.5, 7354.9),
('괘법동', (SELECT id FROM region WHERE name = '사상구' AND is_deleted = FALSE), '부산광역시 사상구', 35.1639625, 128.9884531, 2, 48, 3.5, 1, 'B', 256.6, 7037.2),
('모라북구경계 지하차도', (SELECT id FROM region WHERE name = '사상구' AND is_deleted = FALSE), '부산광역시 사상구', 35.193945, 128.99035, 2.1, 14.5, 7.2, 2, 'B', 245.6, 9467.5),
('주례역왕굴다리지하차도', (SELECT id FROM region WHERE name = '사상구' AND is_deleted = FALSE), '부산광역시 사상구', 35.152690, 129.003230, 5, 30, 16.5, 2, 'B', 324.5, 5350),
('주례역교차로지하차도', (SELECT id FROM region WHERE name = '사상구' AND is_deleted = FALSE), '부산광역시 사상구', 35.1514171, 129.0030179, 5, 53, 25, 4, 'B', 295.3, 5283.4),
('자유아파트', (SELECT id FROM region WHERE name = '사상구' AND is_deleted = FALSE), '부산광역시 사상구', 35.180769, 128.988075, 4.5, 35, 25, 4, 'B', 606.1, 8486.8),
('온골지하차도', (SELECT id FROM region WHERE name = '사상구' AND is_deleted = FALSE), '부산광역시 사상구', 35.15293, 128.996573, 4.2, 46, 5.5, 1, 'B', 573, 5861.7),
('주례지하차도', (SELECT id FROM region WHERE name = '사상구' AND is_deleted = FALSE), '부산광역시 사상구', 35.1524402, 129.0044598, 5, 123, 6, 1, 'B', 221.1, 5246.1),
('한일시멘트', (SELECT id FROM region WHERE name = '사상구' AND is_deleted = FALSE), '부산광역시 사상구', 35.172773, 128.988287, 4.5, 79, 13.8, 2, 'B', 713.3, 7859),
('감천지하차도', (SELECT id FROM region WHERE name = '사하구' AND is_deleted = FALSE), '부산광역시 사하구', 35.0864125, 128.9967656, 4.7, 964, 10, 4, 'A', 1514.7, 347.2),
('장평지하차도', (SELECT id FROM region WHERE name = '사하구' AND is_deleted = FALSE), '부산광역시 사하구', 35.084959, 128.981989, 4.5, 2000, 21.7, 4, 'UNKNOWN', 1027.4, 1328.1),
('부산센텀시티 지하차도', (SELECT id FROM region WHERE name = '해운대구' AND is_deleted = FALSE), '부산광역시 해운대구', 35.170524, 129.126182, 5, 1370, 30, 6, 'B', 115.2, 633.8),
('센텀지하차도', (SELECT id FROM region WHERE name = '해운대구' AND is_deleted = FALSE), '부산광역시 해운대구', 35.176764, 129.124401, 4.5, 100, 18, 4, 'C', 331.6, 1211.6),
('수영강변 지하차도', (SELECT id FROM region WHERE name = '해운대구' AND is_deleted = FALSE), '부산광역시 해운대구', 35.1846125, 129.1182656, 5, 400, 18, 4, 'B', 45.2, 2212.4),
('우동 지하차도', (SELECT id FROM region WHERE name = '해운대구' AND is_deleted = FALSE), '부산광역시 해운대구', 35.1744625, 129.1643906, 4.5, 145.5, 30, 6, 'B', 469, 1703.3),
('원동IC 인근 지하차도', (SELECT id FROM region WHERE name = '해운대구' AND is_deleted = FALSE), '부산광역시 해운대구', 35.191497, 129.113678, 5, 4, 6, 1, 'A', 52.4, 3087),
('좌동 지하차도', (SELECT id FROM region WHERE name = '해운대구' AND is_deleted = FALSE), '부산광역시 해운대구', 35.176549, 129.183386, 4.5, 265, 18, 4, 'B', 1014.8, 1239.2),
('중동지하차도', (SELECT id FROM region WHERE name = '해운대구' AND is_deleted = FALSE), '부산광역시 해운대구', 35.166402, 129.165501, 4.5, 85, 20, 6, 'C', 805.4, 816.2);

-- =====================================================================
-- 9. camera — 지하차도별 카메라 5대 (APPROACH_LPR 2 + FINAL_LPR 2 + CCTV 1)
--    카메라 ID 배치: 지하차도 N → 카메라 (N-1)*5+1 ~ (N-1)*5+5
--    순서: 상행입구(1), 상행출구(2), 하행입구(3), 하행출구(4), CCTV(5), 좌표는 지하차도 좌표에서 조금씩 어긋나게
-- =====================================================================
INSERT INTO camera (underpass_id, role, stream_url, dist, lat, lng)
SELECT u.id, s.role::camera_role,
       'rtsp://cam' || LPAD(((u.id - 1) * 5 + s.slot)::text, 2, '0') || '.puf.local/stream',
       s.dist, u.lat + s.dlat, u.lng + s.dlng
FROM underpass u
CROSS JOIN (VALUES
  (1, 'APPROACH_LPR', 200,  0.0010, -0.0005),
  (2, 'FINAL_LPR',     50,  0.0005, -0.0002),
  (3, 'APPROACH_LPR', 200, -0.0010,  0.0005),
  (4, 'FINAL_LPR',     50, -0.0005,  0.0002),
  (5, 'CCTV',        NULL,  0,       0)
) AS s(slot, role, dist, dlat, dlng)
ORDER BY u.id, s.slot;

-- =====================================================================
-- 10. underpass 카메라 참조 UPDATE (위 카메라 ID 배치 규칙 그대로)
-- =====================================================================
UPDATE underpass SET up_entry_cam_id   = (id - 1) * 5 + 1,
                     up_exit_cam_id    = (id - 1) * 5 + 2,
                     down_entry_cam_id = (id - 1) * 5 + 3,
                     down_exit_cam_id  = (id - 1) * 5 + 4;

-- =====================================================================
-- 11. pm_equipment — 지하차도별 설비 (CCTV 1 + DISPLAY 1 + PUMP 1)
--     equip_id 배치: 지하차도 N → (N-1)*3+1(CCTV), +2(DISPLAY), +3(PUMP)
-- =====================================================================
INSERT INTO pm_equipment (underpass_id, type, cam_id)
SELECT u.id, s.type::pm_equipment_type, CASE WHEN s.type = 'CCTV' THEN (u.id - 1) * 5 + 5 END
FROM underpass u
CROSS JOIN (VALUES (1, 'CCTV'), (2, 'DISPLAY'), (3, 'PUMP')) AS s(slot, type)
ORDER BY u.id, s.slot;

-- 11-1. 선제 차단 대상 (수위 5cm 에서 차단) — 시연/테스트용 1곳 지정. 실제 운영에서는 관리자가 지정
UPDATE underpass SET early_block = TRUE WHERE name = '초량 제1지하차도';

-- =====================================================================
-- 12. threshold — 지하차도별 위험도 임계치 (안전 0 / 관심 40 / 주의 70. 경계·심각은 수위로만 판정하므로 행 없음)
--     updated_by = 그 지하차도 지역을 담당하는 관리자(manager_region 1:1 기본 매핑: 지역 id - 1)
-- =====================================================================
INSERT INTO threshold (underpass_id, level, min_score, updated_by)
SELECT u.id, s.level::risk_level, s.min_score, u.region_id - 1
FROM underpass u
CROSS JOIN (VALUES ('안전', 0), ('관심', 40), ('주의', 70)) AS s(level, min_score)
ORDER BY u.id, s.min_score;

-- =====================================================================
-- 13. pm_threshold — 설비별 예지보전 임계치
--     CCTV 안전 0 / 주의 40 / 위험 65 (recognition_rate 기반 별도 기준)
--     DISPLAY 안전 0 / 주의 50 / 위험 80,  PUMP 안전 0 / 주의 45 / 위험 75
-- =====================================================================
INSERT INTO pm_threshold (equip_id, level, min_score, updated_by)
SELECT e.id, s.level::pm_level, s.min_score, u.region_id - 1
FROM pm_equipment e
JOIN underpass u ON u.id = e.underpass_id
JOIN (VALUES
  ('CCTV',    '안전', 0), ('CCTV',    '주의', 40), ('CCTV',    '위험', 65),
  ('DISPLAY', '안전', 0), ('DISPLAY', '주의', 50), ('DISPLAY', '위험', 80),
  ('PUMP',    '안전', 0), ('PUMP',    '주의', 45), ('PUMP',    '위험', 75)
) AS s(type, level, min_score) ON s.type = e.type::text
ORDER BY e.id, s.min_score;

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
INSERT INTO reason_preset (type, content) VALUES
('BLOCK',   '집중호우로 인한 수위 상승'),
('BLOCK',   '태풍 접근에 따른 사전 차단'),
('BLOCK',   '배수펌프 고장으로 인한 침수 위험'),
('BLOCK',   '하천 범람 경보 발령'),
('BLOCK',   '도로 결빙 위험'),
('BLOCK',   '시설물 긴급 점검'),
('BLOCK',   '공사로 인한 임시 차단'),
('RELEASE', '수위 안정화에 따른 해제'),
('RELEASE', '기상 호전에 따른 해제'),
('RELEASE', '점검 완료 후 정상 개통');

-- =====================================================================
-- 16. display_preset — 전광판 프리셋 (단계별 1건씩, 총 5건)
-- =====================================================================
INSERT INTO display_preset (category, content) VALUES
('SAFE',     '안전 — 통행 가능합니다'),
('INTEREST', '관심 — 비 내리는 중, 안전운전하세요'),
('CAUTION',  '주의 — 수위 상승 중, 서행하세요'),
('BLOCK',   '차단 — 통행 금지, 우회도로 이용'),
('RELEASE', '해제 — 통행이 재개되었습니다');

-- =====================================================================
-- 17. faq — 자주묻는질문 5건
-- =====================================================================
INSERT INTO faq (category, sort_order, question, answer, manager_id) VALUES
('NOTIFICATION', 1, '지하차도 침수 위험 알림은 어떻게 받나요?',
 '회원가입 후 차량을 등록하시면, 해당 차량이 지하차도 부근에서 감지될 때 자동으로 알림을 받으실 수 있습니다. 웹푸시 또는 문자(SMS)로 발송됩니다.',
 1),
('VEHICLE', 2, '차량 등록은 몇 대까지 가능한가요?',
 '등록 대수 제한은 없습니다. 가족 공유 차량의 경우, 같은 번호판을 여러 회원이 각각 등록할 수 있습니다.',
 1),
('USAGE', 3, '지하차도가 차단되면 언제 해제되나요?',
 '수위가 안전 기준 이하로 내려가고, 관리자가 현장을 확인한 후 해제됩니다. 해제 시 알림을 다시 발송해 드립니다.',
 5),
('USAGE', 4, '위험도 점수는 어떻게 산출되나요?',
 'AI 모델이 현재 강수량, 누적 강수량, 지하차도 구조(높이/길이/폭), 인근 하천 거리, 과거 침수 이력 등을 종합하여 0~100점으로 산출합니다.',
 6),
('ETC', 5, '예지보전이 뭔가요?',
 'CCTV, 전광판, 배수펌프 등 시설물의 고장을 사전에 예측하는 시스템입니다. 센서 데이터를 분석하여 점검이 필요한 설비를 미리 알려줍니다.',
 11);

-- =====================================================================
-- 18. notice — 공지사항 3건
-- =====================================================================
INSERT INTO notice (category, title, content, is_important, send_push, manager_id) VALUES
('INFO', 'PUF 시스템 오픈 안내',
 '부산광역시 지하차도 침수 예방 시스템(PUF)이 정식 오픈되었습니다. 차량을 등록하시면 위험 알림을 받으실 수 있습니다.',
 TRUE, FALSE, 1),
('URGENT', '태풍 대비 사전 안내',
 '기상청 예보에 따라 이번 주말 태풍 영향이 예상됩니다. 지하차도 이용 시 각별히 주의해 주시기 바랍니다.',
 TRUE, TRUE, 9),
('MAINTENANCE', '시스템 정기 점검 안내',
 '10월 25일(금) 02:00~06:00 시스템 정기 점검이 예정되어 있습니다. 해당 시간 동안 서비스 이용이 제한될 수 있습니다.',
 FALSE, FALSE, 1);

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
-- underpass:    1~45 (엑셀 순서: 강서구 → 금정구 → 기장군 → … → 해운대구)
-- camera:       1~225 (지하차도당 5대)
-- pm_equipment: 1~135 (지하차도당 3대: CCTV/DISPLAY/PUMP)
--   DISPLAY 설비 ID: (지하차도 id - 1) * 3 + 2  (2, 5, 8, ...)
-- threshold:    1~135 (지하차도당 3단계)
-- pm_threshold: 1~405 (설비당 3단계)
-- weather_area: 1~16 (부산 16구군)
-- reason_preset:  1~10
-- display_preset: 1~5 (SAFE/INTEREST/CAUTION/BLOCK/RELEASE)
-- faq:          1~5
-- notice:       1~3
-- device_token: 1~12

-- =====================================================================
-- 99. 알림 센터 샘플 (고객 알림 3분류 / 관리자 알림 4분류 모두 1건 이상)
--     실제 운영에서는 서비스 코드가 자동으로 만들고, 이 행들은 화면 확인용 샘플이다.
-- =====================================================================
INSERT INTO customer_notification (customer_id, category, title, body, ref_type, ref_id, is_read) VALUES
(1, 'RISK',    '지하차도 접근 알림',  '등록하신 차량이 위험 지하차도에 접근 중입니다.', 'ALERT',   NULL, FALSE),
(1, 'NOTICE',  '새 공지',             'PUF 시스템 오픈 안내',                           'NOTICE',  1,    FALSE),
(1, 'NOTICE',  '[긴급] 새 공지',      '태풍 대비 사전 안내',                            'NOTICE',  2,    TRUE),
(1, 'INQUIRY', '문의 답변 등록',      '문의하신 내용에 답변이 등록되었습니다.',         'INQUIRY', NULL, FALSE);

INSERT INTO manager_notification (category, region_id, title, body, ref_type, ref_id) VALUES
('RISK',      NULL, '위험도 상승',        '위험 단계로 올라간 지하차도가 있습니다.',       'UNDERPASS', NULL),
('EQUIPMENT', NULL, '설비 점검 필요',      '점검이 필요한 설비가 있습니다. (예지보전)',     'EQUIPMENT', NULL),
('TASK',      NULL, '번호판 수동 판별 필요', '수동 판별이 필요한 번호판이 있습니다.',        'PLATE_LOG', NULL),
('SYSTEM',    NULL, '데이터 수신 지연',    '위험도 데이터 수신이 지연되고 있습니다.',       NULL,        NULL);
