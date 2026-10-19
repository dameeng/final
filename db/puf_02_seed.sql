-- =====================================================================
-- PUF 더미 데이터 (전제: puf_01_ddl.sql 직후 실행)
-- 계정: 아이디 = 비밀번호
--   관리자  manager1(최고관리자) ~ manager8   (manager1 = 8자리)
--   고객    customer1 ~ customer28            (비밀번호 8자 이상 규칙 충족)
-- 지역: 프런트 17개 시도 + 미배정 / 지하차도 66곳 (서울 10, 부산 10, 나머지 15개 지역 3곳씩, 미배정 1곳)
-- 구성: 지역·직원·관리자 → 고객·차량 → 지하차도·임계치·카메라 → 시나리오(위험도·이벤트·번호판·알림) → 게시판 → 날씨지역
-- =====================================================================

-- ==================== 지역 / 직원 / 관리자 ====================
BEGIN;

-- '미배정'은 puf_01_ddl.sql 에서 이미 생성됨 (id=1). 프런트 지도의 17개 시도를 전부 등록
INSERT INTO region (name)
SELECT v.name FROM (VALUES (1, '서울'),
                           (2, '경기'),
                           (3, '인천'),
                           (4, '부산'),
                           (5, '대구'),
                           (6, '광주'),
                           (7, '대전'),
                           (8, '울산'),
                           (9, '세종'),
                           (10, '강원'),
                           (11, '충북'),
                           (12, '충남'),
                           (13, '전북'),
                           (14, '전남'),
                           (15, '경북'),
                           (16, '경남'),
                           (17, '제주')) AS v(ord, name)
 WHERE NOT EXISTS (SELECT 1 FROM region r WHERE r.name = v.name AND r.is_deleted = FALSE)
 ORDER BY v.ord;

-- 양양지하차도는 일부러 '미배정'에 둠 (MP-18 재배정 테스트: 미배정 시설을 강원으로 옮겨보기)

-- ================= 직원 (관리자 가입 시 대조용) =================
INSERT INTO employee (name, birth_date, phone, email) VALUES
  ('시스템관리자', '1990-01-01', '010-0000-0000', 'admin@puf.local'),
  ('박서울',       '1993-04-11', '010-1111-2222', 'seoul.admin@puf.local'),
  ('이경기',       '1994-07-23', '010-3333-4444', 'gyeonggi.admin@puf.local'),
  ('최부산',       '1995-02-14', '010-4444-5555', 'busan.admin@puf.local'),
  ('이신규',       '1996-08-10', '010-5555-6666', 'newbie@puf.local'),       -- 가입신청 테스트용(계정 없음)
  ('정미배',       '1991-12-02', '010-7777-8888', 'unassigned@puf.local'),
  ('김대기',       '1997-03-15', '010-2323-4545', 'pending.kim@puf.local'),
  ('최대기',       '1998-09-30', '010-6767-8989', 'pending.choi@puf.local'),
  ('한퇴사',       '1989-05-05', '010-9090-1010', 'withdrawn.han@puf.local'),
  -- 팀원 5명: 관리자 가입 테스트용(계정 없음). 생년월일·전화번호·이메일은 임시값이니 본인 걸로 바꿔서 사용
  ('권유담',    '2000-01-01', '010-1111-0001', 'kwon@example.com'),
  ('박경민', '2000-01-02', '010-1111-0002', 'parkkm@example.com'),
  ('조호근',     '2000-01-03', '010-1111-0003', 'jo@example.com'),
  ('허유진',     '2000-01-04', '010-1111-0004', 'heo@example.com'),
  ('금별이',    '2000-01-06', '010-1111-0006', 'geum@example.com')
ON CONFLICT (email) DO NOTHING;

-- ================= 관리자 계정 (아이디 = 비밀번호) =================
-- manager1 = 최고관리자
INSERT INTO manager (employee_id, login_id, password, role, status, region_id, created_at, approved_at)
SELECT e.id, 'manager1', '$2a$10$DCGD.H8ybCblLw2jgB1kP.AyLPucAfGaQDFjglK31t/gck/qgJPR6',
       'SUPER_ADMIN', 'ACTIVE', NULL, NOW() - interval '60 days', NOW() - interval '60 days'
  FROM employee e WHERE e.email = 'admin@puf.local'
ON CONFLICT (login_id) DO NOTHING;

-- manager2~8 = 지역담당자 (manager2 서울 / manager3 경기 / manager4 부산 / manager5 미배정 / manager6·7 가입대기 / manager8 탈퇴)
INSERT INTO manager (employee_id, login_id, password, role, status, region_id, created_at, approved_by, approved_at)
SELECT e.id, v.login_id, v.pw,
       'REGIONAL_ADMIN', v.status::manager_status, r.id,
       NOW() - v.created_ago::interval,
       CASE WHEN v.status = 'PENDING' THEN NULL ELSE a.id END,
       CASE WHEN v.status = 'PENDING' THEN NULL ELSE NOW() - v.created_ago::interval + interval '1 day' END
  FROM (VALUES
          ('seoul.admin@puf.local',    'manager2', '$2a$10$0won9ahiE6/pS3..odiMNeWQ4hM/FofQMVYV8dvegG3XHian5fiVu', 'ACTIVE',    '서울',   '30 days', 1),
          ('gyeonggi.admin@puf.local', 'manager3', '$2a$10$DihdRDbXOaU9VYSm9LMhouD0RmBGNU.G/uZNiBJHY5mnmTiRdiYw6', 'ACTIVE',    '경기',   '30 days', 2),
          ('busan.admin@puf.local',    'manager4', '$2a$10$u0vGf.qJEaBI9Q.gbnDzTufpK5NzS/LvK5VhF8IKeYA/b9dN4GG8O', 'ACTIVE',    '부산',   '30 days', 3),
          ('unassigned@puf.local',     'manager5', '$2a$10$l48q9FM0dwUk/XFUz2Fivuu88cOwuxOxwM27vrjIu.Ah7waEWiQBO', 'ACTIVE',    '미배정', '20 days', 4),
          ('pending.kim@puf.local',    'manager6', '$2a$10$rj0VLMH9l.T2KsgqRIden..8BSRXeOA6B7DdVFr8RmntCx4dEOPPW', 'PENDING',   NULL,     '1 day',   5),
          ('pending.choi@puf.local',   'manager7', '$2a$10$RLQixd1Kkm4vAP6Mp2vj/eq4PZIH8Q29dfFdqasqS2t0TUkLXB4MK', 'PENDING',   NULL,     '3 hours', 6),
          ('withdrawn.han@puf.local',  'manager8', '$2a$10$KzceFDXR1D54vVqYdlspyuyR3hOvxvxUDew7QmhlkhIIPjfqrFjAC', 'WITHDRAWN', '서울',   '45 days', 7)
       ) AS v(email, login_id, pw, status, region_name, created_ago, ord)
  JOIN employee e ON e.email = v.email
  JOIN manager a ON a.login_id = 'manager1'
  LEFT JOIN region r ON r.name = v.region_name AND r.is_deleted = FALSE
 ORDER BY v.ord
ON CONFLICT (login_id) DO NOTHING;

COMMIT;

-- ==================== 고객 28명 + 등록 차량 84대 ====================
-- 번호판 84대(front_1.mp4 ↔ back_1.mp4 기준)를 고객 28명 × 3대로 묶음. 로그인 아이디 = 비밀번호 : customer1 ~ customer30
-- 번호판은 정렬된 목록 순서대로 3대씩 배정: customer1 = 1~3번째, customer2 = 4~6번째 ...
-- customer29·30 = 인식률 낮은 번호판 보유 고객(저신뢰 → 수동판별 시연용)
BEGIN;

INSERT INTO customer (login_id, password, name, birth_date, email, zipcode, road_address, detail_address, phone, emergency) VALUES
  ('customer1', '$2a$10$MseR0XhX8AxFdnKfzSuvc.q/exKZ9/mCi25Kn9s6TBB/m0X.ec9pO', '김민준', '1965-01-01', 'customer1@puf.local', '06236', '서울특별시 강남구 테헤란로 123', '101동 1203호', '010-2000-1000', '010-3000-2000'),
  ('customer2', '$2a$10$0TLs8v/O0LqnV3L2si5b2O.ChCAbZQd6adBDpxZnuql0MXHW8gfLK', '이서연', '1972-06-12', 'customer2@puf.local', '04524', '서울특별시 중구 세종대로 110', '경남빌딩 5층', '010-2137-1271', '010-3211-2389'),
  ('customer3', '$2a$10$/QvsVEFreMee.BZyLkgee.prCg0WzsyvCUMoxF98oPMirYumF2asu', '박지호', '1979-11-23', 'customer3@puf.local', '07281', '서울특별시 영등포구 여의대로 108', '302호', '010-2274-1542', '010-3422-2778'),
  ('customer4', '$2a$10$WlGKEInJpz7AcdZ7jLgeeexDvGPCMUYUNzwK8c0dcI03SBtz81bLO', '최수아', '1986-04-06', 'customer4@puf.local', '13529', '경기도 성남시 분당구 판교역로 235', 'B동 810호', '010-2411-1813', '010-3633-3167'),
  ('customer5', '$2a$10$luVByCBpT3pGERFD6URFjOjk8PK8IT.SXIoTDkMTGn54MKUsKxERW', '정도윤', '1993-09-17', 'customer5@puf.local', '16490', '경기도 수원시 영통구 광교중앙로 145', '205동 1501호', '010-2548-2084', '010-3844-3556'),
  ('customer6', '$2a$10$fz1OEs69biFApsZGsVgMpuPaL9.Q1IVWZEXNQlzJCN.dYT//tHbXe', '강하은', '1965-02-28', 'customer6@puf.local', '21554', '인천광역시 남동구 인주대로 593', '7층', '010-2685-2355', '010-4055-3945'),
  ('customer7', '$2a$10$/09M6wOKitceDgKa4lVbkOxFFXb/4ANzZzal.UISeefjU76MzCVje', '조현우', '1972-07-11', 'customer7@puf.local', '47545', '부산광역시 연제구 중앙대로 1001', '1102호', '010-2822-2626', '010-4266-4334'),
  ('customer8', '$2a$10$6VWhMwqXYSXbM.tcbg.Qg.JUNogc6EjH7qbCmcziVSkL2W7LnwFxm', '윤지민', '1979-12-22', 'customer8@puf.local', '30151', '세종특별자치시 한누리대로 2130', '904호', '010-2959-2897', '010-4477-4723'),
  ('customer9', '$2a$10$YTBYiP.F00RtljPPaCgIc.PsPXGmT7oSKcZHitvGZMLpUmNe96NZ.', '장예준', '1986-05-05', 'customer9@puf.local', '06236', '서울특별시 강남구 테헤란로 123', '101동 1203호', '010-3096-3168', '010-4688-5112'),
  ('customer10', '$2a$10$25y9KYvU05WuEBC7IfImLOJASeYI1Zduv3a2Nb3EouNMkSIP2UGT2', '임서윤', '1993-10-16', 'customer10@puf.local', '04524', '서울특별시 중구 세종대로 110', '경남빌딩 5층', '010-3233-3439', '010-4899-5501'),
  ('customer11', '$2a$10$vzAUGcdhiYuMWi5F4cWoX.yR/TaXCg6iqSMdgf5sogVQviYDDTthu', '한지후', '1965-03-27', 'customer11@puf.local', '07281', '서울특별시 영등포구 여의대로 108', '302호', '010-3370-3710', '010-5110-5890'),
  ('customer12', '$2a$10$cqr.2PcUK5g5/2Qp4/bBVeX/rKKTFn0bLb0Knq1U2hWqpIBKguQdO', '오채원', '1972-08-10', 'customer12@puf.local', '13529', '경기도 성남시 분당구 판교역로 235', 'B동 810호', '010-3507-3981', '010-5321-6279'),
  ('customer13', '$2a$10$6B9gVx1tFpP.BnGysZOuQehAm8Y5JPEMuNJqvtKRPLSMWcfss4poy', '서건우', '1979-01-21', 'customer13@puf.local', '16490', '경기도 수원시 영통구 광교중앙로 145', '205동 1501호', '010-3644-4252', '010-5532-6668'),
  ('customer14', '$2a$10$uTO1WHS9DudOXJs1WzLQvehuCoU8ccqxGPDvzAsqjakXgwO1Xhb/e', '신유나', '1986-06-04', 'customer14@puf.local', '21554', '인천광역시 남동구 인주대로 593', '7층', '010-3781-4523', '010-5743-7057'),
  ('customer15', '$2a$10$vl.Sn/6Og/HBSGS6leOUh.Mz3CRmzKk4i8SRxhvf1lAZ1HyOvr2Ie', '권시우', '1993-11-15', 'customer15@puf.local', '47545', '부산광역시 연제구 중앙대로 1001', '1102호', '010-3918-4794', '010-5954-7446'),
  ('customer16', '$2a$10$powrteH/sByQ/uwYAegdnezd4lu848PfGI7JGlSjF2W8x4xMopTdm', '황다은', '1965-04-26', 'customer16@puf.local', '30151', '세종특별자치시 한누리대로 2130', '904호', '010-4055-5065', '010-6165-7835'),
  ('customer17', '$2a$10$nGPVXd/r8AxY2nyYuqtw1OXzrLaTXW.acQ.tBalh3MMBIuAAvDrrm', '안준서', '1972-09-09', 'customer17@puf.local', '06236', '서울특별시 강남구 테헤란로 123', '101동 1203호', '010-4192-5336', '010-6376-8224'),
  ('customer18', '$2a$10$1FnDgtGLq7BtBaYoOc108uDea9zbBck7O0ps326n72qI4YfQ3yYN2', '송지유', '1979-02-20', 'customer18@puf.local', '04524', '서울특별시 중구 세종대로 110', '경남빌딩 5층', '010-4329-5607', '010-6587-8613'),
  ('customer19', '$2a$10$VW6rqaQcfLJyjtYQ1usv/OhtfgcjdwXZNnwcrWGj6yXIhvAGqvFJa', '전태민', '1986-07-03', 'customer19@puf.local', '07281', '서울특별시 영등포구 여의대로 108', '302호', '010-4466-5878', '010-6798-9002'),
  ('customer20', '$2a$10$cgY.AChVIAm7IXNq/.C0Ou8kI6cF8JMViefhDyi7ESISYQqdzbZvq', '홍소율', '1993-12-14', 'customer20@puf.local', '13529', '경기도 성남시 분당구 판교역로 235', 'B동 810호', '010-4603-6149', '010-7009-9391'),
  ('customer21', '$2a$10$cz4uC.sbaYtDE1VYVpBFyeMLbOctaQOa3qIeM8lKRqhLA9u3VSO22', '고은우', '1965-05-25', 'customer21@puf.local', '16490', '경기도 수원시 영통구 광교중앙로 145', '205동 1501호', '010-4740-6420', '010-7220-9780'),
  ('customer22', '$2a$10$DGoKbPDq8MRyyNR86ijrGeaCfR26C59HlO48FD192lhyjsGOCXLaG', '문하린', '1972-10-08', 'customer22@puf.local', '21554', '인천광역시 남동구 인주대로 593', '7층', '010-4877-6691', '010-7431-2169'),
  ('customer23', '$2a$10$CWtWE0m0xi1yfVEw9m2/QeRI7zGiI.B2j0FvJWdQVeGzjNjyLqiJy', '양재현', '1979-03-19', 'customer23@puf.local', '47545', '부산광역시 연제구 중앙대로 1001', '1102호', '010-5014-6962', '010-7642-2558'),
  ('customer24', '$2a$10$VT8PGZXNu4IGNTQQUA/YU.bF1vr6yCeEjaA5TKufO85b5BZ5ywW06', '손나연', '1986-08-02', 'customer24@puf.local', '30151', '세종특별자치시 한누리대로 2130', '904호', '010-5151-7233', '010-7853-2947'),
  ('customer25', '$2a$10$GqJ7qcKbEWfVARQ3iFjdSuHlD6HHQFTUyfJnHsKoa6UtwtckodjCi', '배도현', '1993-01-13', 'customer25@puf.local', '06236', '서울특별시 강남구 테헤란로 123', '101동 1203호', '010-5288-7504', '010-8064-3336'),
  ('customer26', '$2a$10$Zm5KpGHQkhSd2FUvxD3ViOMuHUEFIN2j9uJ3M9vj39ITfuXzOGNEe', '백서현', '1965-06-24', 'customer26@puf.local', '04524', '서울특별시 중구 세종대로 110', '경남빌딩 5층', '010-5425-7775', '010-8275-3725'),
  ('customer27', '$2a$10$SgLXAcIH5jO63OcRcC0Q5eN6yT8zgVVU6AqmO1pcTeN/fm9PnlBh.', '허진우', '1972-11-07', 'customer27@puf.local', '07281', '서울특별시 영등포구 여의대로 108', '302호', '010-5562-8046', '010-8486-4114'),
  ('customer28', '$2a$10$vA.Wdl.owkodJncF7o5PsO/Dl3kxq0Sty4WuApocE2JbFk4UmOkrK', '남가은', '1979-04-18', 'customer28@puf.local', '13529', '경기도 성남시 분당구 판교역로 235', 'B동 810호', '010-5699-8317', '010-8697-4503'),
  ('customer29', '$2a$10$N4hKmsRRUHBCmcHOLowspen9aV10QFIHHE7Nf/kLNMF3H.mA9seuG', '유나라', '1988-03-09', 'customer29@puf.local', '06236', '서울특별시 강남구 테헤란로 123', '101동 1203호', '010-5836-8588', '010-8908-4892'),
  ('customer30', '$2a$10$5hecbCoNMvTY/K7S1X23a.0NXbFXI8KxJ8N7uLWgbuwtJcfmYfV8O', '민세진', '1991-10-21', 'customer30@puf.local', '21554', '인천광역시 남동구 인주대로 593', '7층', '010-5973-8859', '010-9119-5281');

INSERT INTO car (customer_id, car_num)
SELECT c.id, v.car_num FROM (VALUES
  ('customer1', '01도9158'),
  ('customer1', '01소5879'),
  ('customer1', '02저3207'),
  ('customer2', '04소3518'),
  ('customer2', '05부0108'),
  ('customer2', '07너9000'),
  ('customer3', '104호1576'),
  ('customer3', '107너9922'),
  ('customer3', '114더1731'),
  ('customer4', '119나2263'),
  ('customer4', '11모5202'),
  ('customer4', '121저7710'),
  ('customer5', '124소4142'),
  ('customer5', '12오9280'),
  ('customer5', '12주7157'),
  ('customer6', '137누7558'),
  ('customer6', '149우3882'),
  ('customer6', '150어1600'),
  ('customer7', '152부7520'),
  ('customer7', '163호7329'),
  ('customer7', '163호9081'),
  ('customer8', '165거1761'),
  ('customer8', '165모7376'),
  ('customer8', '16구7100'),
  ('customer9', '174호1083'),
  ('customer9', '175조5251'),
  ('customer9', '179누1118'),
  ('customer10', '184누9165'),
  ('customer10', '184조4361'),
  ('customer10', '18마5272'),
  ('customer11', '190더4953'),
  ('customer11', '190호4523'),
  ('customer11', '196호6790'),
  ('customer12', '205수4926'),
  ('customer12', '206나6277'),
  ('customer12', '207너4692'),
  ('customer13', '21도5742'),
  ('customer13', '227두8646'),
  ('customer13', '23누7060'),
  ('customer14', '248소4935'),
  ('customer14', '251부9182'),
  ('customer14', '259더3943'),
  ('customer15', '25라6825'),
  ('customer15', '25저3444'),
  ('customer15', '267구5428'),
  ('customer16', '27어6767'),
  ('customer16', '289거4831'),
  ('customer16', '28어4371'),
  ('customer17', '29도4026'),
  ('customer17', '311구7333'),
  ('customer17', '314버4543'),
  ('customer18', '315구1037'),
  ('customer18', '331수9651'),
  ('customer18', '333구7817'),
  ('customer19', '42더9073'),
  ('customer19', '43라6199'),
  ('customer19', '49다6032'),
  ('customer20', '51수8230'),
  ('customer20', '51주8019'),
  ('customer20', '58조3904'),
  ('customer21', '61더0806'),
  ('customer21', '61도3774'),
  ('customer21', '62더0984'),
  ('customer22', '63다8061'),
  ('customer22', '68구6527'),
  ('customer22', '68마3243'),
  ('customer23', '709노9901'),
  ('customer23', '73부0769'),
  ('customer23', '805도7274'),
  ('customer24', '807누2056'),
  ('customer24', '80소3059'),
  ('customer24', '813어8639'),
  ('customer25', '814노2317'),
  ('customer25', '82너9814'),
  ('customer25', '84도3850'),
  ('customer26', '86우5311'),
  ('customer26', '87거6265'),
  ('customer26', '88오6461'),
  ('customer27', '89거0525'),
  ('customer27', '90더8078'),
  ('customer27', '92버5254'),
  ('customer28', '93보3452'),
  ('customer28', '998더8210'),
  ('customer28', '서울32사3667'),
  -- 인식률 낮은 번호판 6대 (front_1 영상 기준 최고 자신감 0.58~0.92, 2회 이상 읽힌 번호). LOW_CONFIDENCE → 수동판별 시연용
  ('customer29', '30무1946'),
  ('customer29', '165어6576'),
  ('customer29', '142무8639'),
  ('customer30', '인천30바8946'),
  ('customer30', '86무5566'),
  ('customer30', '343너2012')
) AS v(login_id, car_num) JOIN customer c ON c.login_id = v.login_id
ORDER BY v.login_id, v.car_num;

COMMIT;


-- ==================== 지하차도 66곳 / 임계치(+이력) / 카메라 ====================
-- 서울 10 · 부산 10 · 나머지 15개 지역 3곳씩 · 미배정 1(양양, MP-18 재배정 테스트용)
-- id 1~31 = 기존 AI 모델 입력 엑셀 31곳(높이·길이 그대로 유지), id 32~66 = 추가분(높이·길이는 더미)
-- 좌표·주소는 해당 지역 시가지 기준의 근사값 → 지도에는 대략적인 위치로만 표시됨
-- 월계3(id17)·여의교(id23)·도봉(id24)·동래(id3)만 카메라 보유, 초지역(id31)은 임계치 수정 이력
BEGIN;

INSERT INTO underpass (id, name, region_id, road_address, latitude, longitude, height_m, length_m,
                       flood_history_count, current_status, current_risk_level, created_at)
SELECT v.id, v.name, r.id, v.addr, v.lat, v.lng, v.h, v.len, v.flood,
       v.status::underpass_current_status, v.risk::risk_level, NOW() - interval '30 days'
  FROM (VALUES
          (1, '부평지하차도', '인천', '인천광역시 계양구 다남로', 37.5709343, 126.7359951, 4.40, 92.00, 1, 'NORMAL', '안전'),
          (2, '고양지하차도', '경기', '경기도 고양시 덕양구 고양시청로', 37.658378, 126.8319401, 4.50, 205.00, 1, 'NORMAL', '안전'),
          (3, '동래지하차도', '부산', '부산광역시 동래구 충렬대로', 35.2046511, 129.0773598, 4.00, 132.00, 1, 'NORMAL', '안전'),
          (4, '무안지하차도', '전남', '전라남도 무안군 무안로', 34.9904562, 126.4817074, 4.50, 124.00, 1, 'NORMAL', '안전'),
          (5, '동구지하차도', '부산', '부산광역시 동구 초량동', 35.1192248, 129.0444814, 4.40, 96.00, 2, 'NORMAL', '안전'),
          (6, '사상지하차도', '부산', '부산광역시 사상구 백양대로646번나길', 35.1624853, 128.989003, 3.80, 191.00, 1, 'NORMAL', '안전'),
          (7, '아름지하차도', '세종', '세종특별자치시 아름동', 36.5175411, 127.247467, 4.00, 93.00, 1, 'NORMAL', '안전'),
          (8, '양양지하차도', '미배정', '강원특별자치도 양양군 남문로', 38.075494, 128.619005, 4.40, 294.00, 2, 'NORMAL', '안전'),
          (9, '금천지하차도', '충북', '충청북도 청주시 상당구 금천동', 36.6267342, 127.5051017, 4.60, 161.00, 2, 'NORMAL', '안전'),
          (10, '아산지하차도', '충남', '충청남도 아산시 충무로', 36.7822462, 127.004294, 4.50, 254.00, 1, 'NORMAL', '안전'),
          (11, '태안지하차도', '충남', '충청남도 태안군 군청로', 36.7456901, 126.2980462, 4.10, 190.00, 1, 'NORMAL', '안전'),
          (12, '칠곡지하차도', '경북', '경상북도 칠곡군 군청1길', 35.9955834, 128.4017635, 4.80, 252.00, 1, 'NORMAL', '안전'),
          (13, '성산지하차도', '서울', '서울특별시 마포구 성산동', 37.5614255, 126.8987546, 4.50, 168.00, 0, 'NORMAL', '안전'),
          (14, '송도지하차도', '인천', '인천광역시 연수구 송도동', 37.3925, 126.6395, 4.10, 282.00, 0, 'NORMAL', '안전'),
          (15, '원주지하차도', '강원', '강원특별자치도 원주시 시청로', 37.3422, 127.9202, 4.60, 133.00, 0, 'NORMAL', '안전'),
          (16, '월계2지하차도', '서울', '서울특별시 노원구 마들로', 37.6322505, 127.0623656, 4.40, 323.00, 0, 'NORMAL', '안전'),
          (17, '월계3지하차도', '서울', '서울특별시 노원구 마들로', 37.6305674, 127.063236, 3.60, 304.00, 0, 'BLOCKED', '위험'),
          (18, '청라지하차도', '인천', '인천광역시 서구 청라동', 37.534, 126.642, 4.80, 193.00, 0, 'NORMAL', '안전'),
          (19, '개화지하차도', '서울', '서울특별시 강서구 방화동', 37.5727313, 126.8074181, 4.50, 101.00, 0, 'NORMAL', '안전'),
          (20, '공항입구지하차도', '서울', '서울특별시 강서구 공항동', 37.563873, 126.810608, 4.50, 391.00, 0, 'NORMAL', '안전'),
          (21, '충주지하차도', '충북', '충청북도 충주시 중앙로', 36.991, 127.926, 3.70, 223.00, 0, 'NORMAL', '안전'),
          (22, '염곡동서지하차도', '서울', '서울특별시 서초구 염곡동', 37.46568, 127.04314, 4.10, 366.00, 0, 'NORMAL', '안전'),
          (23, '여의교지하차도', '서울', '서울특별시 영등포구 신길7동', 37.5146171, 126.926985, 4.00, 297.00, 0, 'NORMAL', '경고'),
          (24, '도봉지하차도', '서울', '서울특별시 노원구 동부간선로', 37.6545106, 127.0533324, 4.70, 329.00, 0, 'NORMAL', '안전'),
          (25, '천안지하차도', '충남', '충청남도 천안시 동남구', 36.815, 127.1139, 4.30, 323.00, 0, 'NORMAL', '안전'),
          (26, '강릉지하차도', '강원', '강원특별자치도 강릉시 강릉대로', 37.7519, 128.8761, 4.60, 142.00, 0, 'NORMAL', '안전'),
          (27, '구일역앞지하차도', '서울', '서울특별시 구로구 구일로', 37.4963802, 126.8708946, 4.10, 196.00, 0, 'NORMAL', '안전'),
          (28, '수락지하차도', '서울', '서울특별시 노원구 동일로', 37.686695, 127.0555091, 3.80, 229.00, 0, 'NORMAL', '안전'),
          (29, '궁평2지하차도', '충북', '충청북도 청주시 흥덕구 미호강변로', 36.6226831, 127.3452699, 4.20, 239.00, 1, 'NORMAL', '안전'),
          (30, '신길지하차도', '경기', '경기도 안산시 단원구 신길동', 37.3330885, 126.7792426, 3.60, 94.00, 0, 'NORMAL', '안전'),
          (31, '초지역지하차도', '경기', '경기도 안산시 단원구 초지동', 37.3199372, 126.8087324, 4.60, 255.00, 0, 'NORMAL', '안전'),
          (32, '해운대지하차도', '부산', '부산광역시 해운대구 해운대로', 35.1631, 129.1639, 4.40, 160.00, 0, 'NORMAL', '안전'),
          (33, '수영지하차도', '부산', '부산광역시 수영구 수영로', 35.1453, 129.1132, 4.20, 210.00, 0, 'NORMAL', '안전'),
          (34, '대연지하차도', '부산', '부산광역시 남구 대연동', 35.1366, 129.0845, 4.00, 190.00, 0, 'NORMAL', '안전'),
          (35, '서면지하차도', '부산', '부산광역시 부산진구 중앙대로', 35.1579, 129.0597, 4.60, 140.00, 0, 'NORMAL', '안전'),
          (36, '구포지하차도', '부산', '부산광역시 북구 구포동', 35.2083, 128.9988, 3.90, 270.00, 0, 'NORMAL', '안전'),
          (37, '하단지하차도', '부산', '부산광역시 사하구 하단동', 35.1046, 128.9667, 4.30, 175.00, 0, 'NORMAL', '안전'),
          (38, '명지지하차도', '부산', '부산광역시 강서구 명지동', 35.095, 128.912, 4.10, 230.00, 0, 'NORMAL', '안전'),
          (39, '구미지하차도', '경북', '경상북도 구미시 구미대로', 36.1195, 128.3446, 4.50, 200.00, 0, 'NORMAL', '안전'),
          (40, '포항지하차도', '경북', '경상북도 포항시 남구', 36.019, 129.3435, 3.80, 310.00, 0, 'NORMAL', '안전'),
          (41, '나성지하차도', '세종', '세종특별자치시 나성동', 36.4955, 127.26, 4.60, 130.00, 0, 'NORMAL', '안전'),
          (42, '조치원지하차도', '세종', '세종특별자치시 조치원읍', 36.601, 127.297, 3.90, 280.00, 0, 'NORMAL', '안전'),
          (43, '목포지하차도', '전남', '전라남도 목포시 영산로', 34.8118, 126.3922, 4.40, 150.00, 0, 'NORMAL', '안전'),
          (44, '여수지하차도', '전남', '전라남도 여수시 시청로', 34.7604, 127.6622, 4.00, 240.00, 0, 'NORMAL', '안전'),
          (45, '속초지하차도', '강원', '강원특별자치도 속초시 중앙로', 38.207, 128.591, 4.20, 210.00, 0, 'NORMAL', '안전'),
          (46, '동대구지하차도', '대구', '대구광역시 동구 동대구로', 35.8795, 128.6283, 4.30, 220.00, 0, 'NORMAL', '안전'),
          (47, '수성지하차도', '대구', '대구광역시 수성구 달구벌대로', 35.8581, 128.6307, 4.00, 180.00, 0, 'NORMAL', '안전'),
          (48, '달서지하차도', '대구', '대구광역시 달서구 월배로', 35.8296, 128.5326, 4.50, 260.00, 0, 'NORMAL', '안전'),
          (49, '상무지하차도', '광주', '광주광역시 서구 상무중앙로', 35.1527, 126.8514, 4.40, 170.00, 0, 'NORMAL', '안전'),
          (50, '첨단지하차도', '광주', '광주광역시 북구 첨단과기로', 35.2262, 126.8429, 4.10, 240.00, 0, 'NORMAL', '안전'),
          (51, '광천지하차도', '광주', '광주광역시 서구 무진대로', 35.1604, 126.8795, 3.90, 200.00, 0, 'NORMAL', '안전'),
          (52, '둔산지하차도', '대전', '대전광역시 서구 둔산대로', 36.3512, 127.3779, 4.50, 150.00, 0, 'NORMAL', '안전'),
          (53, '유성지하차도', '대전', '대전광역시 유성구 대학로', 36.3622, 127.3563, 4.20, 230.00, 0, 'NORMAL', '안전'),
          (54, '대전역지하차도', '대전', '대전광역시 동구 중앙로', 36.3318, 127.4343, 4.00, 190.00, 0, 'NORMAL', '안전'),
          (55, '삼산지하차도', '울산', '울산광역시 남구 삼산로', 35.5392, 129.338, 4.30, 200.00, 0, 'NORMAL', '안전'),
          (56, '태화지하차도', '울산', '울산광역시 중구 태화로', 35.5545, 129.307, 4.00, 160.00, 0, 'NORMAL', '안전'),
          (57, '신정지하차도', '울산', '울산광역시 남구 신정동', 35.5388, 129.3115, 4.60, 240.00, 0, 'NORMAL', '안전'),
          (58, '전주지하차도', '전북', '전북특별자치도 전주시 덕진구', 35.8242, 127.148, 4.40, 180.00, 0, 'NORMAL', '안전'),
          (59, '익산지하차도', '전북', '전북특별자치도 익산시 인북로', 35.9483, 126.9577, 4.10, 250.00, 0, 'NORMAL', '안전'),
          (60, '군산지하차도', '전북', '전북특별자치도 군산시 월명로', 35.9676, 126.7369, 4.20, 210.00, 0, 'NORMAL', '안전'),
          (61, '창원지하차도', '경남', '경상남도 창원시 성산구 중앙대로', 35.228, 128.6811, 4.50, 220.00, 0, 'NORMAL', '안전'),
          (62, '진주지하차도', '경남', '경상남도 진주시 진주대로', 35.18, 128.1076, 4.00, 170.00, 0, 'NORMAL', '안전'),
          (63, '김해지하차도', '경남', '경상남도 김해시 김해대로', 35.2285, 128.889, 4.30, 260.00, 0, 'NORMAL', '안전'),
          (64, '연동지하차도', '제주', '제주특별자치도 제주시 연동', 33.489, 126.493, 4.20, 150.00, 0, 'NORMAL', '안전'),
          (65, '노형지하차도', '제주', '제주특별자치도 제주시 노형동', 33.485, 126.478, 4.00, 190.00, 0, 'NORMAL', '안전'),
          (66, '서귀포지하차도', '제주', '제주특별자치도 서귀포시 중앙로', 33.2541, 126.56, 4.40, 230.00, 0, 'NORMAL', '안전')
       ) AS v(id, name, region_name, addr, lat, lng, h, len, flood, status, risk)
  JOIN region r ON r.name = v.region_name AND r.is_deleted = FALSE
 ORDER BY v.id;

-- id를 직접 지정해서 넣었으므로 시퀀스를 맞춰둔다
SELECT setval(pg_get_serial_sequence('underpass', 'id'), (SELECT MAX(id) FROM underpass));

-- ================= 임계치 (기본값 0/40/70) + 최초 생성 이력 =================
INSERT INTO threshold (underpass_id, level, risk_score_min, updated_by, updated_at)
SELECT u.id, lv.level::risk_level, lv.min_val, m.id, u.created_at
  FROM underpass u
  CROSS JOIN (VALUES ('안전', 0.00), ('경고', 40.00), ('위험', 70.00)) AS lv(level, min_val)
  JOIN manager m ON m.login_id = 'manager1'
 WHERE NOT EXISTS (SELECT 1 FROM threshold t WHERE t.underpass_id = u.id AND t.level = lv.level::risk_level);

INSERT INTO threshold_history (threshold_id, old_risk_score_min, new_risk_score_min, changed_by, changed_at)
SELECT t.id, NULL, t.risk_score_min, t.updated_by, t.updated_at
  FROM threshold t
 WHERE NOT EXISTS (SELECT 1 FROM threshold_history h WHERE h.threshold_id = t.id AND h.old_risk_score_min IS NULL);

-- 초지역지하차도 '경고' 기준을 40 → 45로 조정한 이력 (MP-19 변경이력 확인용)
UPDATE threshold t SET risk_score_min = 45.00, updated_at = NOW() - interval '2 days'
  FROM underpass u
 WHERE t.underpass_id = u.id AND u.name = '초지역지하차도' AND t.level = '경고' AND t.risk_score_min = 40.00;

INSERT INTO threshold_history (threshold_id, old_risk_score_min, new_risk_score_min, changed_by, changed_at)
SELECT t.id, 40.00, 45.00, m.id, NOW() - interval '2 days'
  FROM threshold t
  JOIN underpass u ON u.id = t.underpass_id AND u.name = '초지역지하차도'
  JOIN manager m ON m.login_id = 'manager1'
 WHERE t.level = '경고'
   AND NOT EXISTS (SELECT 1 FROM threshold_history h WHERE h.threshold_id = t.id AND h.old_risk_score_min = 40.00);

-- ================= 카메라 =================
-- APPROACH_LPR = 접근길목(300m 전), ROI_LPR = 진입직전(30m 전), CCTV = 일반 감시
-- ord 순서대로 넣으므로 camera id 1 = 월계3 APPROACH_LPR
INSERT INTO underpass_camera (underpass_id, camera_role, stream_url, distance_m, latitude, longitude, created_at)
SELECT u.id, v.role::camera_role,
       'rtsp://demo.puf.local/' || v.slug || '/' || lower(v.role),
       v.dist, u.latitude + v.dlat, u.longitude, u.created_at
  FROM (VALUES
          (1, '월계3지하차도',   'wolgye3',  'APPROACH_LPR', 300, -0.0027),
          (2, '월계3지하차도',   'wolgye3',  'ROI_LPR',       30, -0.0003),
          (3, '월계3지하차도',   'wolgye3',  'CCTV',           0,  0.0000),
          (4, '여의교지하차도', 'yeouigyo', 'APPROACH_LPR', 300, -0.0027),
          (5, '여의교지하차도', 'yeouigyo', 'ROI_LPR',       30, -0.0003),
          (6, '도봉지하차도',   'dobong',   'APPROACH_LPR', 300, -0.0027),
          (7, '도봉지하차도',   'dobong',   'ROI_LPR',       30, -0.0003),
          (8, '동래지하차도',   'dongnae',  'APPROACH_LPR', 300, -0.0027),
          (9, '동래지하차도',   'dongnae',  'ROI_LPR',       30, -0.0003)
       ) AS v(ord, name, slug, role, dist, dlat)
  JOIN underpass u ON u.name = v.name
 ORDER BY v.ord;

-- 입구 = APPROACH_LPR, 출구 = ROI_LPR 로 지정
UPDATE underpass u SET entry_camera_id = c.id
  FROM underpass_camera c
 WHERE c.underpass_id = u.id AND c.camera_role = 'APPROACH_LPR' AND c.is_deleted = FALSE
   AND u.entry_camera_id IS NULL;
UPDATE underpass u SET exit_camera_id = c.id
  FROM underpass_camera c
 WHERE c.underpass_id = u.id AND c.camera_role = 'ROI_LPR' AND c.is_deleted = FALSE
   AND u.exit_camera_id IS NULL;

-- 월계3: 실시간 관제 탭의 CCTV 전환(1~4)을 보여주려고 CCTV 3대 추가
INSERT INTO underpass_camera (underpass_id, camera_role, stream_url, distance_m, latitude, longitude, created_at)
SELECT u.id, 'CCTV', 'rtsp://demo.puf.local/wolgye3/cctv' || n, 0, u.latitude, u.longitude, u.created_at
  FROM underpass u, generate_series(2, 4) AS n
 WHERE u.name = '월계3지하차도'
   AND (SELECT COUNT(*) FROM underpass_camera c WHERE c.underpass_id = u.id AND c.camera_role = 'CCTV') < 4;

-- AI 서버 스트림 연결
UPDATE underpass_camera SET stream_url = '/ai/stream/1' WHERE id = 1;

COMMIT;

-- ==================== 위험도 14일 이력 / 이벤트 / 전광판 / 번호판 로그 / 통과기록 / 알림 ====================
-- 번호판은 등록 차량 84대 기준 (01도9158=customer1, 04소3518=customer2, 25라6825=customer15, 18마5272=customer10, 63다8061=customer22)
-- 날씨 VIEW 와 같은 그림: 서울·경기·인천 = 폭풍 강함 / 부산·경남·울산 = 약함 / 나머지 = 평온
-- 특수 시나리오(지금 상태): 월계3 4시간 동안 10→85(위험, 차단) / 여의교 8→55(경고) / 도봉 어제 폭풍 한 번(경고→안전) / 동래 10→38(경고 직전)
BEGIN;


-- ================= 위험도 이력: 지하차도마다 최근 14일 =================
-- 간격: 14일 전 ~ 25시간 전은 1시간 간격(312건), 최근 24시간은 10분 간격(145건) → 지하차도당 457건, 마지막 점 = 지금
--   점수 = 기본값(취약할수록 높음) + 폭풍 4번(지역마다 시각이 어긋남) × 취약도 + 잡음
--   취약도(v) = 1 - (0.5×(높이-3.5)/1.5 + 0.5×(400-길이)/330)  (엑셀 '튼튼함'의 반대)
--   폭풍은 모두 지금보다 24시간 이상 전에 끝나서, 아래 3곳 외에는 지금 전부 '안전'으로 끝남
--   특수 시나리오(지금 상태): 월계3 4시간 동안 10→85(위험, 차단) / 여의교 8→55(경고) / 도봉 어제 폭풍 한 번(경고→안전)
CREATE TEMP TABLE _ts ON COMMIT DROP AS
SELECT g AS ts FROM generate_series(NOW() - interval '336 hours', NOW() - interval '25 hours', interval '1 hour') g
UNION ALL
SELECT g FROM generate_series(NOW() - interval '24 hours', NOW(), interval '10 minutes') g;

INSERT INTO risk_score (underpass_id, risk_score, rainfall_mm, rainfall_1h_mm, rainfall_3h_mm,
                        rainfall_6h_mm, rainfall_12h_mm, rainfall_24h_mm, predicted_at)
SELECT u.id, s.score,
       round(s.score * 0.14, 2), round(s.score * 0.14, 2), round(s.score * 0.40, 2),
       round(s.score * 0.60, 2), round(s.score * 0.75, 2), round(s.score * 0.90, 2),
       t.ts
  FROM underpass u
  JOIN region r ON r.id = u.region_id
  CROSS JOIN _ts t
  CROSS JOIN LATERAL (SELECT EXTRACT(EPOCH FROM (t.ts - (NOW() - interval '336 hours'))) / 3600.0 AS x,
                             (abs(hashtext(r.name)) % 24) - 12 AS shift,
                             GREATEST(0, LEAST(1, 1 - (0.5 * (u.height_m - 3.5) / 1.5 + 0.5 * (400 - u.length_m) / 330))) AS v,
                             CASE WHEN r.name IN ('서울', '경기', '인천') THEN 1.0
                                  WHEN r.name IN ('부산', '경남', '울산') THEN 0.35
                                  ELSE 0 END AS amp) p
  CROSS JOIN LATERAL (SELECT COALESCE(SUM(st.a * exp(-power((p.x - st.c - p.shift) / 7.0, 2))), 0) AS storm
                        FROM (VALUES (40, 0.55), (120, 0.95), (200, 0.60), (270, 0.85)) AS st(c, a)) w
  CROSS JOIN LATERAL (
       SELECT round(LEAST(99.0, GREATEST(0.0,
              CASE
                -- 월계3: 최근 4시간 동안 10 → 85
                WHEN u.name = '월계3지하차도' AND t.ts >= NOW() - interval '4 hours'
                     THEN 10 + 75 * power(EXTRACT(EPOCH FROM (t.ts - (NOW() - interval '4 hours'))) / 14400.0, 1.5)
                -- 여의교: 최근 4시간 동안 8 → 55
                WHEN u.name = '여의교지하차도' AND t.ts >= NOW() - interval '4 hours'
                     THEN 8 + 47 * power(EXTRACT(EPOCH FROM (t.ts - (NOW() - interval '4 hours'))) / 14400.0, 1.3)
                -- 동래(부산): 최근 4시간 동안 10 → 38 (경고 직전까지만 → 서울과 대비되는 '약한 비' 시연용)
                WHEN u.name = '동래지하차도' AND t.ts >= NOW() - interval '4 hours'
                     THEN 10 + 28 * power(EXTRACT(EPOCH FROM (t.ts - (NOW() - interval '4 hours'))) / 14400.0, 1.3)
                ELSE 3 + 12 * p.v + (28 + 62 * p.v) * LEAST(1.0, w.storm) * p.amp
                     -- 도봉: 약 27시간 전 폭풍 한 번 더(경고 단계까지만, 약 4시간)
                     + CASE WHEN u.name = '도봉지하차도'
                            THEN 46 * exp(-power((p.x - 309) / 3.0, 2)) ELSE 0 END
              END
              + ((hashtext(u.id::text || 'n' || t.ts::text) & 2147483647) % 100) / 100.0 * 3 - 1.5
       ))::numeric, 2) AS score) s
 WHERE u.is_deleted = FALSE;

-- ================= 지하차도 이벤트 (MP-16 제어이력) =================
-- 위험도 단계 변화: 위 점수가 임계치(기본 안전 0 / 경고 40 / 위험 70, 초지역 경고 45)를 넘나든 시점마다 UP / DOWN 이벤트
WITH lv AS (
    SELECT rs.underpass_id, rs.predicted_at, rs.risk_score,
           (SELECT t.level FROM threshold t
             WHERE t.underpass_id = rs.underpass_id AND rs.risk_score >= t.risk_score_min
             ORDER BY t.risk_score_min DESC LIMIT 1) AS lvl
      FROM risk_score rs
), ch AS (
    SELECT lv.*, LAG(lvl) OVER (PARTITION BY underpass_id ORDER BY predicted_at) AS prev_lvl FROM lv
)
INSERT INTO underpass_event (underpass_id, event_type, risk_level, risk_score_at_event, created_at)
SELECT underpass_id,
       CASE WHEN lvl > prev_lvl THEN 'RISK_LEVEL_UP' ELSE 'RISK_LEVEL_DOWN' END::underpass_event_type,
       lvl, risk_score, predicted_at
  FROM ch
 WHERE prev_lvl IS NOT NULL AND lvl <> prev_lvl
 ORDER BY predicted_at, underpass_id;

-- 현재 위험 단계 = 마지막 점수가 속한 단계
UPDATE underpass u SET current_risk_level = x.lvl
  FROM (SELECT DISTINCT ON (rs.underpass_id) rs.underpass_id,
               (SELECT t.level FROM threshold t
                 WHERE t.underpass_id = rs.underpass_id AND rs.risk_score >= t.risk_score_min
                 ORDER BY t.risk_score_min DESC LIMIT 1) AS lvl
          FROM risk_score rs ORDER BY rs.underpass_id, rs.predicted_at DESC) x
 WHERE u.id = x.underpass_id;

-- 월계3: 위험 단계 진입 15분 뒤 서울 담당자가 차단 (지금 차단 중)
INSERT INTO underpass_event (underpass_id, event_type, operator_id, created_at)
SELECT u.id, 'BLOCK', m.id, NOW() - interval '15 minutes'
  FROM underpass u, manager m
 WHERE u.name = '월계3지하차도' AND m.login_id = 'manager2';

-- 도봉: 어제 폭풍 때 경고 진입 10분 뒤 차단 → 안전 복귀 10분 뒤 해제 (이벤트 4종 모두 확인 가능)
INSERT INTO underpass_event (underpass_id, event_type, operator_id, created_at)
SELECT u.id, 'BLOCK', m.id, up.created_at + interval '10 minutes'
  FROM underpass u JOIN manager m ON m.login_id = 'manager2'
  CROSS JOIN LATERAL (SELECT e.created_at FROM underpass_event e
                       WHERE e.underpass_id = u.id AND e.event_type = 'RISK_LEVEL_UP' AND e.risk_level = '경고'
                       ORDER BY e.created_at DESC LIMIT 1) up
 WHERE u.name = '도봉지하차도';
INSERT INTO underpass_event (underpass_id, event_type, operator_id, created_at)
SELECT u.id, 'RELEASE', m.id, dn.created_at + interval '10 minutes'
  FROM underpass u JOIN manager m ON m.login_id = 'manager2'
  CROSS JOIN LATERAL (SELECT e.created_at FROM underpass_event e
                       WHERE e.underpass_id = u.id AND e.event_type = 'RISK_LEVEL_DOWN' AND e.risk_level = '안전'
                       ORDER BY e.created_at DESC LIMIT 1) dn
 WHERE u.name = '도봉지하차도';

-- 차단 중인 지하차도는 가장 최근 BLOCK 이벤트를 current_block_event_id로 연결
UPDATE underpass u SET current_block_event_id = (
         SELECT e.id FROM underpass_event e
          WHERE e.underpass_id = u.id AND e.event_type = 'BLOCK'
          ORDER BY e.created_at DESC, e.id DESC LIMIT 1)
 WHERE u.current_status = 'BLOCKED' AND u.current_block_event_id IS NULL;

-- ================= 전광판 조작 로그 (MP-16 제어이력에 함께 표시) =================
-- 월계3·여의교: 가장 최근 경고 진입 2분 뒤 경고 표출 / 차단·해제는 그 이벤트 1분 뒤 안내 표출
INSERT INTO display_log (underpass_id, message_type, operator_id, created_at)
SELECT u.id, v.mtype::display_message_type, m.id, e.created_at + v.after::interval
  FROM (VALUES
          ('월계3지하차도', 'RISK_WARNING', 'RISK_LEVEL_UP', '경고', '2 minutes'),
          ('월계3지하차도', 'BLOCK_NOTICE', 'BLOCK',         NULL,   '1 minute'),
          ('여의교지하차도', 'RISK_WARNING', 'RISK_LEVEL_UP', '경고', '2 minutes'),
          ('도봉지하차도', 'BLOCK_NOTICE',   'BLOCK',         NULL,   '1 minute'),
          ('도봉지하차도', 'RELEASE_NOTICE', 'RELEASE',       NULL,   '1 minute')
       ) AS v(name, mtype, etype, level, after)
  JOIN underpass u ON u.name = v.name
  JOIN manager m ON m.login_id = 'manager2'
  CROSS JOIN LATERAL (SELECT e2.created_at FROM underpass_event e2
                       WHERE e2.underpass_id = u.id AND e2.event_type = v.etype::underpass_event_type
                         AND (v.level IS NULL OR e2.risk_level = v.level::risk_level)
                       ORDER BY e2.created_at DESC LIMIT 1) e;

-- ================= 번호판 인식 로그 =================
-- cam: E = 입구(entry_camera), X = 출구(exit_camera)
-- image_path는 데모 데이터라 전부 NULL(=FastAPI가 아직 캡처 이미지를 안 보낸 상태)로 둔다.
-- 실제 연동 후에는 InternalIngestServiceImpl.saveImage()가 자동으로 채운다.
INSERT INTO plate_log (camera_id, detected_num, corrected_num, confidence, recognition_status, car_id,
                       review_status, review_deadline, reviewed_by, reviewed_at, detected_at)
SELECT CASE v.cam WHEN 'E' THEN u.entry_camera_id ELSE u.exit_camera_id END,
       v.detected, v.corrected, v.conf, v.rstatus::recognition_status, ca.id,
       v.review::review_status,
       CASE WHEN v.review = 'NONE' THEN NULL
            WHEN v.review = 'PENDING' THEN NOW() + interval '30 minutes'   -- 시드 직후 판별 테스트할 여유
            ELSE NOW() - v.ago::interval + interval '10 minutes' END,
       m.id,
       CASE WHEN m.id IS NULL THEN NULL ELSE NOW() - v.ago::interval + interval '3 minutes' END,
       NOW() - v.ago::interval
  FROM (VALUES
          -- 월계3: customer1이 3시간 전 정상 통과
          ('월계3지하차도',   'E', '01도9158', NULL,       0.972, 'SUCCESS',        '01도9158', 'NONE',           NULL,          '3 hours'),
          ('월계3지하차도',   'X', '01도9158', NULL,       0.958, 'SUCCESS',        '01도9158', 'NONE',           NULL,          '2 hours 58 minutes'),
          -- 월계3: 차단 직전 진입해서 갇힌 차량 2대(등록 차량 / 미등록 차량)
          ('월계3지하차도',   'E', '04소3518', NULL,       0.950, 'SUCCESS',        '04소3518', 'NONE',           NULL,          '20 minutes'),
          ('월계3지하차도',   'E', '99허9999', NULL,       0.931, 'UNMATCHED',      NULL,       'NONE',           NULL,          '18 minutes'),
          -- 월계3: 신뢰도 낮아 관리자 판별 대기 중 (MP-16 판별대기 목록)
          ('월계3지하차도',   'E', '63다80B1', NULL,       0.612, 'LOW_CONFIDENCE', NULL,       'PENDING',        NULL,          '3 minutes'),
          ('월계3지하차도',   'E', '30무1946', NULL,       0.580, 'LOW_CONFIDENCE', NULL,       'PENDING',        NULL,          '1 minute'),
          -- 여의교: 2시간 전 저신뢰 인식 → 관리자가 수정 확정 → 출구 정상 통과
          ('여의교지하차도', 'E', '25라682B', '25라6825', 0.588, 'LOW_CONFIDENCE', '25라6825', 'CONFIRMED',      'manager2', '2 hours'),
          ('여의교지하차도', 'X', '25라6825', NULL,       0.965, 'SUCCESS',        '25라6825', 'NONE',           NULL,          '1 hour 57 minutes'),
          -- 여의교: 방금 진입해서 통과 중
          ('여의교지하차도', 'E', '18마5272', NULL,       0.964, 'SUCCESS',        '18마5272', 'NONE',           NULL,          '1 minute'),
          -- 도봉: 어제 저신뢰 인식이 기한 내 검토되지 않아 자동처리됨
          ('도봉지하차도', 'E', '11바2222', NULL,       0.540, 'LOW_CONFIDENCE', NULL,       'AUTO_PROCESSED', NULL,          '1 day 2 hours')
       ) AS v(underpass, cam, detected, corrected, conf, rstatus, car_num, review, reviewer, ago)
  JOIN underpass u ON u.name = v.underpass
  LEFT JOIN car ca ON ca.car_num = v.car_num
  LEFT JOIN manager m ON m.login_id = v.reviewer
 WHERE NOT EXISTS (
       SELECT 1 FROM plate_log pl
        WHERE pl.camera_id = CASE v.cam WHEN 'E' THEN u.entry_camera_id ELSE u.exit_camera_id END
          AND pl.detected_num = v.detected);

-- 판별대기 1건('63다80B1' = 63다8061 오인식)에는 캡처 이미지가 있다고 가정한 데모용 샘플 경로를 넣어둔다.
-- (실제 파일은 없으므로 프런트에서 <img> 깨짐이 뜨는 게 정상 - 연동 전 테스트용)
UPDATE plate_log pl SET image_path = 'plate-logs/demo/63da80b1-sample.jpg'
 WHERE pl.detected_num = '63다80B1' AND pl.image_path IS NULL;

-- ================= 통과기록 / 잔류차량 (MP-10) =================
-- 입구 인식 로그 1건당 통과기록 1건. 출구 로그가 있으면 EXITED로 연결한다
INSERT INTO underpass_transit (underpass_id, car_num, entry_plate_log_id, exit_plate_log_id, status, entry_at, exit_at)
SELECT u.id, v.car_num, en.id, ex.id, v.status::transit_status, en.detected_at, ex.detected_at
  FROM (VALUES ('월계3지하차도',   '01도9158', 'EXITED'),
               ('월계3지하차도',   '04소3518', 'REMAINING'),
               ('월계3지하차도',   '99허9999', 'REMAINING'),
               ('여의교지하차도', '25라6825', 'EXITED'),
               ('여의교지하차도', '18마5272', 'IN_TRANSIT')
       ) AS v(underpass, car_num, status)
  JOIN underpass u ON u.name = v.underpass
  JOIN plate_log en ON en.camera_id = u.entry_camera_id
                   AND COALESCE(en.corrected_num, en.detected_num) = v.car_num
  LEFT JOIN plate_log ex ON v.status = 'EXITED' AND ex.camera_id = u.exit_camera_id
                        AND COALESCE(ex.corrected_num, ex.detected_num) = v.car_num
 WHERE NOT EXISTS (SELECT 1 FROM underpass_transit t WHERE t.entry_plate_log_id = en.id);


-- ================= 앱푸시 발송로그 (MP-15, PREDICTIVE/ROI_FINAL 둘 다) =================
-- event_id는 알림의 계기가 된 가장 최근 위험도 상승 이벤트
INSERT INTO alert_log (event_id, customer_id, car_id, car_num, alert_type, sent_at)
-- sent_at이 NULL이면 이벤트 발생 30초 뒤로 넣는다
SELECT e.id, ca.customer_id, ca.id, ca.car_num, v.atype::alert_type,
       COALESCE(v.sent_at, e.created_at + interval '30 seconds')
  FROM (VALUES
          -- 월계3 위험 단계 진입 시 인근 등록차량에 사전 경고
          ('월계3지하차도',   '위험', '01도9158', 'PREDICTIVE', NULL::timestamp),
          -- customer2는 진입 직전 최종 경고를 받았지만 진입 → 이후 차단되어 잔류
          ('월계3지하차도',   '위험', '04소3518', 'ROI_FINAL',  NOW()::timestamp - interval '20 minutes'),
          -- 여의교 경고 단계 사전 알림
          ('여의교지하차도', '경고', '18마5272', 'PREDICTIVE', NULL::timestamp)
       ) AS v(underpass, level, car_num, atype, sent_at)
  JOIN underpass u ON u.name = v.underpass
  CROSS JOIN LATERAL (SELECT e2.id, e2.created_at FROM underpass_event e2
                       WHERE e2.underpass_id = u.id AND e2.event_type = 'RISK_LEVEL_UP' AND e2.risk_level = v.level::risk_level
                       ORDER BY e2.created_at DESC LIMIT 1) e
  JOIN car ca ON ca.car_num = v.car_num;

COMMIT;


-- ==================== 접수의견 / 공지사항 / FAQ ====================
BEGIN;

-- ================= 접수의견 (1:1 문의) =================
INSERT INTO inquiry (customer_id, title, content, created_at)
SELECT c.id, v.title, v.content, NOW() - v.ago::interval
  FROM (VALUES
          ('customer2', '월계3 지하차도 관련 문의',  '차량이 지하차도 안에 갇혔는데 어떻게 해야 하나요?',           '10 minutes'),
          ('customer1', '앱 이용 문의',             '비밀번호를 변경하고 싶은데 방법을 모르겠습니다.',               '5 days'),
          ('customer3', '차량 추가 등록 문의',      '차량을 4대째 등록하려는데 오류가 납니다. 늘릴 수 있나요?',      '2 days'),
          ('customer3', '알림이 늦게 와요',         '여의교 지하차도 경고 알림이 진입 후에 도착했습니다. 확인 부탁드립니다.', '1 day')
       ) AS v(login_id, title, content, ago)
  JOIN customer c ON c.login_id = v.login_id
 WHERE NOT EXISTS (SELECT 1 FROM inquiry i
                    WHERE i.customer_id = c.id AND i.parent_id IS NULL AND i.title = v.title);

-- 답변. deleted = TRUE는 "삭제된 답변" (삭제 후 재답변 가능한지 확인용)
INSERT INTO inquiry (parent_id, author_manager_id, content, is_deleted, created_at)
SELECT p.id, m.id, v.content, v.deleted, p.created_at + v.after::interval
  FROM (VALUES
          ('앱 이용 문의',        'manager1',       '마이페이지 > 비밀번호 변경 메뉴에서 가능합니다. 감사합니다.', FALSE, '3 hours'),
          ('차량 추가 등록 문의', 'manager2', '확인 후 다시 안내드리겠습니다.',                                TRUE,  '1 hour'),
          ('차량 추가 등록 문의', 'manager1',       '차량은 고객 1인당 최대 3대까지 등록 가능합니다. 기존 차량을 삭제한 뒤 등록해 주세요.', FALSE, '5 hours')
       ) AS v(title, operator, content, deleted, after)
  JOIN inquiry p ON p.parent_id IS NULL AND p.title = v.title
  JOIN manager m ON m.login_id = v.operator
 WHERE NOT EXISTS (SELECT 1 FROM inquiry r WHERE r.parent_id = p.id AND r.content = v.content);

-- 살아있는 답글이 있는 원글은 ANSWERED
UPDATE inquiry p SET status = 'ANSWERED'
 WHERE p.parent_id IS NULL AND p.status = 'PENDING'
   AND EXISTS (SELECT 1 FROM inquiry r WHERE r.parent_id = p.id AND r.is_deleted = FALSE);

INSERT INTO inquiry_attachment (inquiry_id, file_url, file_name, created_at)
SELECT i.id, '/uploads/inquiry/demo-alert-screenshot.png', '알림수신화면.png', i.created_at
  FROM inquiry i
 WHERE i.parent_id IS NULL AND i.title = '알림이 늦게 와요'
   AND NOT EXISTS (SELECT 1 FROM inquiry_attachment a WHERE a.inquiry_id = i.id);

-- ================= 공지사항 (중요/일반/삭제됨) =================
INSERT INTO notice (title, content, is_important, author_id, is_deleted, created_at, updated_at)
SELECT v.title, v.content, v.important, m.id, v.deleted, NOW() - v.ago::interval, NOW() - v.ago::interval
  FROM (VALUES
          ('지하차도 침수예방 시스템 오픈 안내', '지하차도 침수예방 시스템이 정식 운영을 시작합니다.',                        TRUE,  'manager1',          FALSE, '30 days'),
          ('정기 점검 안내',                     '매주 화요일 새벽 2시~4시는 시스템 점검 시간입니다.',                         FALSE, 'manager1',          FALSE, '20 days'),
          ('호우 특보 발령 시 통제 안내',        '호우 특보 발령 시 위험 단계 지하차도는 사전 예고 없이 통제될 수 있습니다.', TRUE,  'manager1',          FALSE, '7 days'),
          ('여의교 지하차도 카메라 교체 공사',   '9월 중 여의교 지하차도 진입부 카메라 교체 공사가 진행됩니다.',               FALSE, 'manager2',    FALSE, '3 days'),
          ('초지역 지하차도 배수펌프 점검 완료', '초지역 지하차도 배수펌프 정기 점검이 완료되었습니다.',                         FALSE, 'manager3', FALSE, '1 day'),
          ('[삭제됨] 테스트 공지',               '삭제된 공지는 목록에 보이면 안 됩니다.',                                     FALSE, 'manager1',          TRUE,  '10 days')
       ) AS v(title, content, important, author, deleted, ago)
  JOIN manager m ON m.login_id = v.author
 WHERE NOT EXISTS (SELECT 1 FROM notice n WHERE n.title = v.title);

INSERT INTO notice_attachment (notice_id, file_url, file_name, created_at)
SELECT n.id, '/uploads/notice/demo-flood-control-guide.pdf', '호우시_통제기준.pdf', n.created_at
  FROM notice n
 WHERE n.title = '호우 특보 발령 시 통제 안내'
   AND NOT EXISTS (SELECT 1 FROM notice_attachment a WHERE a.notice_id = n.id);

-- ================= FAQ =================
INSERT INTO faq (question, answer, author_id, is_deleted, created_at, updated_at)
SELECT v.q, v.a, m.id, v.deleted, NOW() - v.ago::interval, NOW() - v.ago::interval
  FROM (VALUES
          ('차량은 몇 대까지 등록할 수 있나요?', '고객 1인당 최대 3대까지 등록 가능합니다.',                                                     FALSE, '30 days'),
          ('알림은 어떤 경우에 오나요?',         '등록한 차량이 위험 지역에 접근하거나 차단된 지하차도에 진입한 경우 알림이 발송됩니다.',        FALSE, '30 days'),
          ('위험도 점수는 어떻게 계산되나요?',   '강수량과 지하차도 구조 정보를 AI 모델에 입력해 0~100점으로 산출합니다.',                         FALSE, '14 days'),
          ('다른 사람이 제 차량번호를 등록했어요.', '차량번호는 한 명만 등록할 수 있습니다. 1:1 문의로 차량등록증을 첨부해 주시면 확인해 드립니다.', FALSE, '7 days'),
          ('[삭제됨] 테스트 FAQ',                '삭제된 FAQ는 목록에 보이면 안 됩니다.',                                                         TRUE,  '5 days')
       ) AS v(q, a, deleted, ago)
  JOIN manager m ON m.login_id = 'manager1'
 WHERE NOT EXISTS (SELECT 1 FROM faq f WHERE f.question = v.q);

INSERT INTO faq_attachment (faq_id, file_url, file_name, created_at)
SELECT f.id, '/uploads/faq/demo-risk-score-guide.png', '위험도_산출방식.png', f.created_at
  FROM faq f
 WHERE f.question = '위험도 점수는 어떻게 계산되나요?'
   AND NOT EXISTS (SELECT 1 FROM faq_attachment a WHERE a.faq_id = f.id);

COMMIT;


-- ==================== 날씨 지역 ====================
-- weather_hourly 는 puf_01_ddl.sql 의 VIEW. 서울 = 폭우 / 부산 = 약한 비 / 나머지 7개 지역 = 맑음
-- (지하차도는 가장 가까운 날씨 지역을 따라가므로 지역별로 위험도가 따로 움직임)
BEGIN;
INSERT INTO weather_area (name, latitude, longitude) VALUES
  ('서울', 37.5665000, 126.9780000), ('부산', 35.1796000, 129.0756000), ('대구', 35.8714000, 128.6014000),
  ('인천', 37.4563000, 126.7052000), ('광주', 35.1595000, 126.8526000), ('대전', 36.3504000, 127.3845000),
  ('울산', 35.5384000, 129.3114000), ('세종', 36.4800000, 127.2890000), ('제주', 33.4996000, 126.5312000)
ON CONFLICT (name) DO NOTHING;
COMMIT;
