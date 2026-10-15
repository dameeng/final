# -*- coding: utf-8 -*-
"""번호판 사진(YOLO로 자른 것) → 번호 읽기. v7 기말고사와 똑같은 방식이에요.
사용법:
    from plate_reader import PlateReader, crop_box
    reader = PlateReader()                        # 서버 켤 때 한 번만 (모델 3개를 켜서 몇 초 걸려요)
    text, conf, ok = reader.read(crop_box(frame, [x0, y0, x1, y1]))
      text: 읽은 번호 (예: "12가3456"), conf: 자신감 0~1, ok: 믿어도 되는지 (규칙 맞음 + 자신감 0.88 이상)
"""
import os, re, sys, copy                                   # 필요한 도구 상자
HERE = os.path.dirname(os.path.abspath(__file__))          # 이 파일이 있는 폴더 (어디에 풀어도 동작)
sys.path.insert(0, os.path.join(HERE, "paddleocr_lib"))    # 같이 넣은 PaddleOCR 코드 등록
import numpy as np, cv2                                    # 숫자 계산, 사진 도구
import tools.infer.utility as utility                      # 설정 도우미
from tools.infer.predict_det import TextDetector           # 글자 줄 찾는 모델
from tools.infer.predict_rec import TextRecognizer         # 글자 읽는 모델

T_IN = 0.88                                                # 자신감 기준: 규칙에 맞고 이 값 이상일 때만 인정
MARGIN = 0.15                                              # YOLO 네모 둘레에 붙이는 여백
RULES = [r"\d{2,3}[가-힣]\d{4}",                          # 새 번호판: 01가3733
         r"영?[가-힣]{2}\d{1,2}[가-힣]\d{4}",             # 지역+숫자: 경기37바1234
         r"[가-힣]{3,6}\d{4}"]                            # 지역+구: 경기부천차0116
PAD_L, PAD_R, PAD_T, PAD_B = 0.103, 0.052, 0.119, 0.190   # 자르기 여백 (학습 사진과 똑같이)
OUT_H = 48                                                # 2줄을 이어 붙일 때 키
det = base = None                                         # 아래 함수들이 쓰는 모델 자리 (PlateReader가 채워요)

# ===== exam_v5.py 62~206줄을 그대로 복사한 함수 (자르기 방식이 시험과 똑같게) =====
def similar(x, y):
    """두 글자열이 얼마나 비슷한지 0~1 (1 = 똑같음)"""
    d = list(range(len(y) + 1))
    for i, cx in enumerate(x, 1):
        prev, d[0] = d[0], i
        for j, cy in enumerate(y, 1):
            prev, d[j] = d[j], min(d[j] + 1, d[j - 1] + 1, prev + (cx != cy))
    return 1 - d[len(y)] / max(len(x), len(y), 1)

def rows_of(boxes):
    """글자 상자들을 줄끼리 묶어요 (위쪽 줄부터)"""
    rects = []
    for b in boxes:
        p = np.array(b).reshape(-1, 2)
        rects.append([p[:, 0].min(), p[:, 1].min(), p[:, 0].max(), p[:, 1].max()])
    rects.sort(key=lambda r: (r[1] + r[3]) / 2)
    rows = [rects[0][:]]
    for r in rects[1:]:
        last = rows[-1]
        overlap = min(last[3], r[3]) - max(last[1], r[1])
        if overlap > 0.5 * min(last[3] - last[1], r[3] - r[1]):
            last[0], last[1] = min(last[0], r[0]), min(last[1], r[1])
            last[2], last[3] = max(last[2], r[2]), max(last[3], r[3])
        else:
            rows.append(r[:])
    return rows

def crop_pad(img, r, y_min=0, y_max=None):
    """네모 r 둘레에 여백을 붙여서 잘라요"""
    x0, y0, x1, y1 = r
    w, h = x1 - x0, y1 - y0
    y_max = img.shape[0] if y_max is None else y_max
    X0 = int(max(0, x0 - w * PAD_L)); X1 = int(min(img.shape[1], x1 + w * PAD_R))
    Y0 = int(max(y_min, y0 - h * PAD_T)); Y1 = int(min(y_max, y1 + h * PAD_B))
    return img[Y0:Y1, X0:X1]

def join_side(top, bot):
    """윗줄과 아랫줄을 키를 맞춰 옆으로 이어 붙여요"""
    top = cv2.resize(top, (max(1, round(top.shape[1] * OUT_H / top.shape[0])), OUT_H))
    bot = cv2.resize(bot, (max(1, round(bot.shape[1] * OUT_H / bot.shape[0])), OUT_H))
    return cv2.hconcat([top, bot])

def candidates(img, rows):
    """후보를 전부 만들어요 [(1줄/2줄, 사진, 윗줄 사진), ...]"""
    cands = []
    for r in rows:
        cands.append(("1줄", crop_pad(img, r), None))
    for top, bot in zip(rows, rows[1:]):
        gap = (top[3] + bot[1]) / 2
        t = crop_pad(img, top, y_max=gap)
        b = crop_pad(img, bot, y_min=gap)
        if t.size == 0 or b.size == 0:
            continue
        cands.append(("2줄", join_side(t, b), t))
    if len(rows) > 1:
        cands.append(("1줄", crop_pad(img, [min(r[0] for r in rows), min(r[1] for r in rows),
                                            max(r[2] for r in rows), max(r[3] for r in rows)]), None))
    return [x for x in cands if x[1].shape[0] >= 8 and x[1].shape[1] >= 16]

def passes(sim, read, label_digits):
    """(정답 보고 자를 때만) 좋은 자르기인지: 기본 모델이 숫자를 85% 이상 맞히거나, 75% 이상 + 뒤 4자리 정확"""
    return sim >= 0.85 or (sim >= 0.75 and re.sub(r"\D", "", read).endswith(label_digits[-4:]))

def top_ok(top_text, label_digits):
    """(정답 보고 자를 때만) 2줄 후보의 윗줄이 진짜 윗줄 같은지"""
    d = re.sub(r"\D", "", top_text)
    if label_digits[-4:] in d:
        return False
    lead = label_digits[:-4]
    if lead and similar(d, lead) < 0.5:
        return False
    return True

def deskew(img, boxes):
    """가장 큰 글자 상자가 기운 만큼 사진을 돌려요. 작은 사진은 3배로 키워요."""
    big = max(boxes, key=lambda b: cv2.contourArea(np.array(b, np.float32).reshape(-1, 2)))
    p = np.array(big, np.float32).reshape(-1, 2)
    ang = float(np.degrees(np.arctan2(p[1][1] - p[0][1], p[1][0] - p[0][0])))
    s = 3 if img.shape[0] < 150 else 1
    h, w = img.shape[:2]
    M = cv2.getRotationMatrix2D((w / 2, h / 2), ang, s)
    W = int(h * abs(M[0, 1]) + w * abs(M[0, 0]))
    H = int(h * abs(M[0, 0]) + w * abs(M[0, 1]))
    M[0, 2] += W / 2 - w / 2; M[1, 2] += H / 2 - h / 2
    return cv2.warpAffine(img, M, (W, H), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)

# ===== 새 함수 =====
def rule_ok(t):
    """번호판 규칙 3개 중 하나에 딱 맞는지"""
    return any(re.fullmatch(p, t) for p in RULES)

def look(im):
    """후보를 만들고 기본 모델로 전부 읽어요. 정답은 안 써요.
    돌려주는 것: (후보들, 후보마다 (읽은 글자, 자신감), {2줄 후보 번호: 윗줄 읽은 글자}, 글자 상자들) 또는 None"""
    boxes, _ = det(im)                                    # 글자 위치 찾기
    if boxes is None or len(boxes) == 0:                  # 못 찾으면
        return None
    cands = candidates(im, rows_of(boxes))                # 후보 만들기 (1줄, 2줄, 전체 네모)
    if not cands:
        return None
    reads = [(t.replace(" ", ""), float(c)) for t, c in base([c[1] for c in cands])[0]]  # 후보 전부 읽기
    two = [n for n, c in enumerate(cands) if c[0] == "2줄"]                  # 2줄 후보 번호들
    tops = [t.replace(" ", "") for t, _ in base([cands[n][2] for n in two])[0]] if two else []  # 윗줄만 읽기
    return cands, reads, dict(zip(two, tops)), boxes

def choose_auto(seen):
    """정답 없이 가장 번호판다운 후보를 골라요. 비교: ① 규칙 ② 자신감 ③ 1줄
    돌려주는 것: (비교 점수, 1줄/2줄, 사진) 또는 None"""
    if seen is None:
        return None
    cands, reads, tops, _ = seen
    best = None
    for n, (t, c) in enumerate(reads):                    # 후보마다
        if n in tops and re.search(r"\d{4}", tops[n]):    #   윗줄에 숫자 4개가 연달아 → 로고 붙인 가짜 2줄
            continue                                      #     건너뛰기
        key = (rule_ok(t), c, cands[n][0] == "1줄")       #   비교 점수
        if best is None or key > best[0]:                 #   지금까지보다 좋으면 기억하기
            best = (key, cands[n][0], cands[n][1])
    return best

def choose_gt(seen, label):
    """★ 정답을 보고 정답과 가장 비슷하게 읽힌 후보를 골라요 (make_v5_crops.py와 같은 방식).
    비교: ① 숫자 비슷함 ② 전체 비슷함 ③ 1줄 ④ 자신감"""
    if seen is None:
        return None
    cands, reads, tops, _ = seen
    digits = re.sub(r"\D", "", label)                     # 정답의 숫자만
    best = None
    for n, (t, c) in enumerate(reads):
        if n in tops and not top_ok(tops[n], digits):     # 윗줄이 이상한 2줄 후보는 건너뛰기
            continue
        key = (similar(re.sub(r"\D", "", t), digits), similar(t, label), cands[n][0] == "1줄", c)
        if best is None or key > best[0]:
            best = (key, cands[n][0], cands[n][1], passes(key[0], t, digits))  # 마지막: 좋은 자르기인지
    return best

def cut(img, choose):
    """사진 한 장을 잘라요. 고른 게 뭉툭한 1줄이면 똑바로 돌려서 한 번 더 고르고, 못하지 않으면 바꿔요."""
    seen = look(img)                                      # 후보 만들고 읽기
    best = choose(seen)                                   # 고르기
    if best and best[1] == "1줄" and best[2].shape[1] < 2.3 * best[2].shape[0]:  # 뭉툭한 1줄이면
        b2 = choose(look(deskew(img, seen[3])))           #   돌려서 다시
        if b2 and b2[0][:2] >= best[0][:2]:               #   앞의 두 점수가 못하지 않으면
            best = b2                                     #     바꾸기
    return best

# ===== 팀원이 쓰는 부분 =====
def crop_box(frame, box, margin=MARGIN):
    """YOLO 네모 [x0, y0, x1, y1]에 여백을 붙여 잘라요 (영상 테스트와 같은 방식)"""
    x0, y0, x1, y1 = map(int, box[:4]); w, h = x1 - x0, y1 - y0
    return frame[max(0, int(y0 - h * margin)):int(y1 + h * margin),
                 max(0, int(x0 - w * margin)):int(x1 + w * margin)]

class PlateReader:
    def __init__(self, use_gpu=True):
        """모델 3개를 켜요. 오래 걸리니까 서버 시작할 때 한 번만 만드세요."""
        global det, base                                   # 위 함수들이 쓰는 모델 자리를 채우려고
        a = utility.init_args().parse_args([])             # 빈 설정 (uvicorn 명령어와 안 섞이게)
        a.use_gpu = use_gpu                                # 그래픽카드 쓸지
        a.det_model_dir = os.path.join(HERE, "models", "det")
        a.det_db_thresh, a.det_db_box_thresh, a.det_db_unclip_ratio = 0.3, 0.5, 1.6  # 시험과 같은 설정
        a.rec_image_shape, a.rec_algorithm, a.rec_batch_num = "3, 48, 320", "SVTR_LCNet", 16
        det = TextDetector(a)                              # 글자 줄 찾기
        base = self._rec(a, "base_rec", "ppocrv5_korean_dict.txt", True)  # 후보 고르는 기본 한글 모델
        self.v7 = self._rec(a, "rec_v7", "plate_dict_v5.txt", False)      # ★ 번호 읽는 v7

    @staticmethod
    def _rec(a, model, dic, space):
        """읽는 모델 하나를 켜요. 설정은 복사해서 써서 서로 안 섞여요."""
        b = copy.copy(a)
        b.rec_model_dir = os.path.join(HERE, "models", model)
        b.rec_char_dict_path = os.path.join(HERE, "dict", dic)
        b.use_space_char = space
        return TextRecognizer(b)

    def read(self, plate_img):
        """번호판 사진 → (읽은 번호, 자신감, 믿어도 되는지)"""
        if plate_img is None or plate_img.size == 0:       # 빈 사진이면
            return "", 0.0, False
        best = cut(plate_img, choose_auto)                 # 글자 찾기 → 후보 고르기 → 기울기 바로잡기
        if not best:                                       # 글자를 못 찾으면
            return "", 0.0, False
        t, c = self.v7([best[2]])[0][0]                    # v7로 읽기
        t = t.replace(" ", "")                             # 띄어쓰기 지우기
        return t, float(c), bool(rule_ok(t) and c >= T_IN) # 규칙 맞고 0.88 이상이면 인정
