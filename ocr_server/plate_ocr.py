# -*- coding: utf-8 -*-
"""번호판 인식: 카메라 영상 -> YOLO(위치) -> 자르기 -> OCR(글자) -> 스크린샷과 함께 Spring 으로 전송.
   + 관리자 CCTV 화면용 실시간 영상(네모 그린 것)도 여기서 만들어요."""
import copy
import logging
import os
import re
import sys
import threading
import time
from collections import deque
from datetime import datetime
from difflib import SequenceMatcher

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from ultralytics import YOLO   # torch 를 paddle 보다 먼저 불러야 해요 (반대로 하면 torch DLL 오류)

import config
import spring

log = logging.getLogger("plate")

if sys.platform == "win32":
    # 윈도우 기본 타이머는 약 16ms 단위라, 24fps(42ms 간격)로 화면을 만들 때 기다리는 시간이 들쭉날쭉해져요.
    # 이 프로세스만 1ms 단위로 바꿈 (프로세스가 끝나면 자동으로 원래대로)
    try:
        import ctypes
        ctypes.windll.winmm.timeBeginPeriod(1)
    except Exception:
        pass

# 한국 번호판 형식. 이 형식이 아니면 "일부만 읽은 것"으로 보고 안 보내요
#   신형: 12가3456, 123가4567      구형: 서울12가3456
REGIONS = "서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주"
PLATE_RE = re.compile(rf"^(\d{{2,3}}|({REGIONS})\d{{1,2}})[가-힣]\d{{4}}$")


def is_valid_plate(text):
    return bool(PLATE_RE.match(text or ""))




class _TorchDetector:
    """원래 방식: ultralytics 로 best.pt 실행 (그래픽카드 PC 또는 OpenVINO 모델이 없을 때)"""

    def __init__(self, path):
        self.model = YOLO(path)

    def detect(self, img):
        r = self.model.predict(img, imgsz=config.YOLO_IMGSZ, conf=config.YOLO_CONF, verbose=False)[0]
        return r.boxes.xyxy.int().tolist(), r.boxes.conf.tolist()


class _OpenVinoDetector:
    """CPU 용: OpenVINO 로 바꾼 같은 모델을 직접 실행. 전처리/후처리는 ultralytics 와 똑같이 맞춤
    (ultralytics 를 거쳐 OpenVINO 를 부르면 torch 와 충돌해서 가끔 프로그램이 통째로 죽어서 직접 불러요)"""

    def __init__(self, xml):
        import openvino as ov
        self.model = ov.Core().compile_model(xml, "CPU", {"PERFORMANCE_HINT": "LATENCY",
                                                           "INFERENCE_NUM_THREADS": config.INFER_THREADS})

    def detect(self, img):
        # 1) 긴 쪽을 1280 에 맞추고(키우지는 않음) 32 배수가 되게 회색(114) 여백을 위아래/좌우에 반씩
        h, w = img.shape[:2]
        r = min(config.YOLO_IMGSZ / h, config.YOLO_IMGSZ / w, 1.0)
        nh, nw = round(h * r), round(w * r)
        ph, pw = (32 - nh % 32) % 32, (32 - nw % 32) % 32
        top, left = int(round(ph / 2 - 0.1)), int(round(pw / 2 - 0.1))
        x = cv2.resize(img, (nw, nh), interpolation=cv2.INTER_LINEAR) if r != 1.0 else img
        x = cv2.copyMakeBorder(x, top, ph - top, left, pw - left, cv2.BORDER_CONSTANT, value=(114, 114, 114))
        x = np.ascontiguousarray(x[:, :, ::-1].transpose(2, 0, 1)[None], dtype=np.float32) / 255.0
        # 2) 결과 (1, 5, N): 가운데x, 가운데y, 너비, 높이, 자신감
        out = self.model(x)[0][0].T
        out = out[out[:, 4] >= config.YOLO_CONF]
        if not len(out):
            return [], []
        cx, cy, bw, bh, conf = out.T
        xywh = np.stack([cx - bw / 2, cy - bh / 2, bw, bh], 1)
        keep = cv2.dnn.NMSBoxes(xywh.tolist(), conf.tolist(), config.YOLO_CONF, 0.7)   # 겹친 네모 정리 (ultralytics 기본 0.7)
        keep = np.array(keep).reshape(-1)
        keep = keep[np.argsort(-conf[keep])]
        # 3) 여백 빼고 원래 사진 크기로 되돌리기
        b = xywh[keep]
        x1 = np.clip((b[:, 0] - left) / r, 0, w)
        y1 = np.clip((b[:, 1] - top) / r, 0, h)
        x2 = np.clip((b[:, 0] + b[:, 2] - left) / r, 0, w)
        y2 = np.clip((b[:, 1] + b[:, 3] - top) / r, 0, h)
        return np.stack([x1, y1, x2, y2], 1).astype(int).tolist(), conf[keep].tolist()


class PlateReader:
    """YOLO + OCR. 서버 켤 때 한 번만 만들고, 모든 카메라가 같이 써요"""

    def __init__(self):
        self.yolo = None
        if not config.USE_GPU and os.path.exists(config.YOLO_OPENVINO_XML):
            self.yolo = _OpenVinoDetector(config.YOLO_OPENVINO_XML)
            log.info("YOLO: OpenVINO (CPU) %s", config.YOLO_OPENVINO_XML)
        if self.yolo is None:
            self.yolo = _TorchDetector(config.YOLO_PATH)
        self.ocr = self._load_ocr()
        self.lock = threading.Lock()   # 여러 카메라가 동시에 모델을 쓰지 않게 (CPU 과부하/충돌 방지)

    @staticmethod
    def _load_ocr():
        """v7: 번호판 안 글자 줄 찾기(det) -> 1줄/2줄 후보 중 고르기(base) -> v7 로 읽기.
        plate_v7_model/plate_reader.py 의 PlateReader 와 같은데, CPU 에서 det 모델이 멈추지 않게 설정만 바꿔요"""
        sys.path.insert(0, config.PLATE_V7_DIR)
        import plate_reader as v7
        a = v7.utility.init_args().parse_args([])
        a.use_gpu = config.USE_GPU
        a.cpu_threads = config.INFER_THREADS   # 기본 10 이면 CPU 를 꽉 채워서 스트림 영상이 끊김
        a.det_model_dir = os.path.join(config.PLATE_V7_DIR, "models", config.PLATE_DET_MODEL)
        a.det_db_thresh, a.det_db_box_thresh, a.det_db_unclip_ratio = 0.3, 0.5, 1.6
        a.rec_image_shape, a.rec_algorithm, a.rec_batch_num = "3, 48, 320", "SVTR_LCNet", 16
        d = copy.copy(a)
        d.enable_mkldnn = config.DET_MKLDNN   # CPU 가속(oneDNN)을 켜면 서버용 det 가 NotImplementedError 로 멈춰서 기본은 끔
        v7.det = v7.TextDetector(d)
        v7.base = v7.PlateReader._rec(a, "base_rec", "ppocrv5_korean_dict.txt", True)
        reader = v7.PlateReader.__new__(v7.PlateReader)
        reader.v7 = v7.PlateReader._rec(a, "rec_v7", "plate_dict_v5.txt", False)
        reader.crop_box = v7.crop_box

        def read(plate_img):
            """v7.PlateReader.read 와 결과는 같은데, 후보가 반듯한 1줄 하나뿐이면 base 로 고르는 단계를 건너뜀.
            후보가 하나면 base 로 읽어 봐야 그걸 고르니까 (bench: front 영상 번호판 158개 전부 이 경우, 번호판당 약 65ms 절약)"""
            if plate_img is None or plate_img.size == 0:
                return "", 0.0, False
            boxes, _ = v7.det(plate_img)
            if boxes is None or len(boxes) == 0:
                return "", 0.0, False
            cands = v7.candidates(plate_img, v7.rows_of(boxes))
            if len(cands) == 1 and cands[0][0] == "1줄" and cands[0][1].shape[1] >= 2.3 * cands[0][1].shape[0]:
                crop = cands[0][1]
            else:   # 2줄 / 후보 여러 개 / 뭉툭한 1줄(기울기 바로잡기) -> 원래 방식 그대로
                best = v7.cut(plate_img, v7.choose_auto)
                if not best:
                    return "", 0.0, False
                crop = best[2]
            t, c = reader.v7([crop])[0][0]
            t = t.replace(" ", "")
            return t, float(c), bool(v7.rule_ok(t) and c >= v7.T_IN)

        reader.read = read
        return reader

    def read(self, img, skip_top=0, timings=None, known=None):
        """사진 한 장 -> [{box, detectConf, text, score, valid, tracked}, ...]
        skip_top: 위에서 이 픽셀만큼은 번호판을 찾지 않음 (OCR 은 원본 사진에서 잘라 읽어요)
        timings: dict 를 넘기면 단계별 시간(ms)을 채워줘요 (시연 페이지용). 대기 = 다른 카메라가 모델 쓰는 동안 기다린 시간
        known: 이미 전송한 차들이 이 사진에 있을 위치 [{box, text, score}] (CameraWorker.known_plates).
               찾은 네모가 그 위치와 맞으면 OCR 을 건너뛰고 그 번호를 그대로 써요 (tracked=True)"""
        t0 = time.time()
        with self.lock:
            t1 = time.time()
            xyxy, confs = self.yolo.detect(img[skip_top:])
            boxes = [[x1, y1 + skip_top, x2, y2 + skip_top] for x1, y1, x2, y2 in xyxy]
            t2 = time.time()
            tracked = _track_match(boxes, known or [])
            # 번호판마다: 여백 15% 붙여 자르기 -> 글자 줄 찾기 -> 읽기 (너무 작은 번호판은 안 읽고 빈 결과)
            texts = [(tracked[i]["text"], tracked[i]["score"]) if i in tracked
                     else self.ocr.read(self.ocr.crop_box(img, box))[:2] if box[2] - box[0] >= config.OCR_MIN_WIDTH
                     else ("", 0.0) for i, box in enumerate(boxes)]
            t3 = time.time()
        if timings is not None:
            timings.update(waitMs=round((t1 - t0) * 1000), detectMs=round((t2 - t1) * 1000),
                           ocrMs=round((t3 - t2) * 1000))
        return [{"box": box, "detectConf": round(float(dc), 3), "text": text,
                 "score": round(float(score), 3), "valid": is_valid_plate(text), "tracked": i in tracked}
                for i, (box, dc, (text, score)) in enumerate(zip(boxes, confs, texts))]


def _reader_process(conn):
    """따로 띄운 프로세스: 모델을 여기서 올리고, 받은 사진을 읽어서 돌려줘요"""
    reader = PlateReader()
    conn.send("ready")
    while True:
        msg = conn.recv()
        if msg is None:
            break
        img, skip_top, known = msg
        timings = {}
        try:
            conn.send(("ok", reader.read(img, skip_top, timings, known), timings))
        except Exception as e:
            conn.send(("error", repr(e), timings))


class ProcessPlateReader:
    """PlateReader 와 쓰는 법(read)은 같은데, 모델은 따로 띄운 프로세스에서 돌려요.
    같은 프로세스에서 돌리면 인식하는 동안 파이썬(GIL)이 스트림 화면 만드는 스레드까지 멈춰서 영상이 끊겨요
    (CPU 측정: 같은 프로세스 6fps / 0.3초 넘게 멈춤 30번 -> 분리하면 멈춤이 거의 없음)"""

    def __init__(self):
        self.lock = threading.Lock()
        self._start()

    def _start(self):
        import multiprocessing as mp
        ctx = mp.get_context("spawn")
        self.conn, child = ctx.Pipe()
        self.proc = ctx.Process(target=_reader_process, args=(child,), daemon=True, name="plate-reader")
        self.proc.start()
        if self.conn.recv() != "ready":
            raise RuntimeError("번호판 인식 프로세스를 못 띄웠어요")
        log.info("번호판 인식 프로세스 시작 (pid %s)", self.proc.pid)

    def read(self, img, skip_top=0, timings=None, known=None):
        t0 = time.time()
        with self.lock:
            t1 = time.time()
            try:
                self.conn.send((img, skip_top, known))
                status, result, t = self.conn.recv()
            except (EOFError, OSError):             # 인식 프로세스가 죽었으면 다시 띄우고 이번 장은 실패 처리
                log.error("번호판 인식 프로세스가 멈춰서 다시 띄워요")
                self._start()
                raise
        if timings is not None:
            timings.update(t, waitMs=round((t1 - t0) * 1000))
        if status != "ok":
            raise RuntimeError(result)
        return result

    def close(self):
        try:
            self.conn.send(None)
        except OSError:
            pass
        self.proc.join(5)


def create_reader():
    """CPU 면 따로 띄운 프로세스에서(스트림 안 끊기게), 그래픽카드 PC면 지금 프로세스에서 인식"""
    return ProcessPlateReader() if config.READER_PROCESS else PlateReader()


_fonts = {}


def _font(size):
    """한글 글꼴 (크기별로 한 번만 불러옴). 글꼴 파일이 없으면 None"""
    if size not in _fonts:
        try:
            _fonts[size] = ImageFont.truetype(config.FONT_PATH, size)
        except OSError:
            log.warning("글꼴을 못 열어서 번호 없이 점수만 표시해요: %s", config.FONT_PATH)
            _fonts[size] = None
    return _fonts[size]


def draw(img, plates, highlight=None):
    """번호판 네모 + 위에 "번호 점수" 글자 그리기.
    highlight 번호는 빨간 굵은 네모, 나머지는 초록(확실)/주황(애매)"""
    out = img.copy()
    labels = []
    for p in plates:
        x1, y1, x2, y2 = p["box"]
        if highlight and p["text"] == highlight:
            color, thick = (0, 0, 255), 5
        else:
            color, thick = ((0, 200, 0) if p["valid"] and p["score"] >= config.INSTANT_SCORE else (0, 165, 255)), 2
        cv2.rectangle(out, (x1, y1), (x2, y2), color, thick)
        labels.append((f"{p['text']} {p['score']:.2f}" if p["text"] else f"{p['score']:.2f}", x1, y1, color))
    font = _font(max(14, out.shape[1] // 55)) if labels else None
    if font is None:                     # 글꼴이 없으면 cv2 로 점수만 (cv2 는 한글을 못 그려요)
        for p, (_, x1, y1, color) in zip(plates, labels):
            cv2.putText(out, f"{p['score']:.2f}", (x1, max(20, y1 - 8)), cv2.FONT_HERSHEY_SIMPLEX, 0.8, color, 2)
        return out
    pil = Image.fromarray(cv2.cvtColor(out, cv2.COLOR_BGR2RGB))
    d = ImageDraw.Draw(pil)
    for text, x1, y1, color in labels:
        l, t, r, b = d.textbbox((0, 0), text, font=font)
        y = max(0, y1 - (b - t) - 8)
        d.rectangle((x1, y, x1 + r - l + 8, y + b - t + 6), fill=color[::-1])   # 글자 배경 (BGR -> RGB)
        d.text((x1 + 4 - l, y + 3 - t), text, font=font, fill=(255, 255, 255))
    return cv2.cvtColor(np.asarray(pil), cv2.COLOR_RGB2BGR)


def to_jpg(img, max_width=1280, quality=85):
    h, w = img.shape[:2]
    if w > max_width:
        img = cv2.resize(img, (max_width, int(h * max_width / w)))
    return cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, quality])[1].tobytes()


def crop_plate(img, box, pad=0.15, min_width=320):
    """판별대기 화면용 스냅샷: 번호판 네모에 여백(pad, 너비/높이 비율)을 붙여 잘라요.
    멀리 있는 번호판은 너무 작아서 min_width 까지 키워요 (글자가 보이게)"""
    x1, y1, x2, y2 = (int(v) for v in box)
    px, py = int((x2 - x1) * pad), int((y2 - y1) * pad)
    h, w = img.shape[:2]
    crop = img[max(0, y1 - py):min(h, y2 + py), max(0, x1 - px):min(w, x2 + px)]
    if crop.shape[1] < min_width:
        crop = cv2.resize(crop, (min_width, round(crop.shape[0] * min_width / crop.shape[1])),
                          interpolation=cv2.INTER_CUBIC)
    return crop


def _video_path(source):
    return os.path.join(config.VIDEO_DIR, source) if not os.path.isabs(source) else source


_sync = {"epoch": None, "period": None, "cameras": None}   # 영상 파일 카메라들이 같이 쓰는 시작 시각 / 한 바퀴 길이 / 같이 도는 카메라
_sync_lock = threading.Lock()


def _sync_clock():
    """같이 도는 영상 파일들이 같이 처음으로 돌아가도록 공통 시작 시각과 한 바퀴 길이(가장 긴 영상 + 딜레이)를 정해요"""
    with _sync_lock:
        if _sync["epoch"] is None:
            period = 1.0
            for cid, source in config.CAMERAS.items():
                if "://" in source or (_sync["cameras"] is not None and cid not in _sync["cameras"]):
                    continue   # 안 도는 카메라 영상 길이는 안 셈 (짧은 영상 하나만 돌 때 끝에서 오래 멈추지 않게)
                cap = cv2.VideoCapture(_video_path(source))
                if cap.isOpened():
                    fps = cap.get(cv2.CAP_PROP_FPS) or 30
                    period = max(period, cap.get(cv2.CAP_PROP_FRAME_COUNT) / fps + config.VIDEO_DELAY_SEC.get(cid, 0))
                cap.release()
            _sync.update(epoch=time.time(), period=period)
        return _sync["epoch"], _sync["period"]


def reset_sync(camera_ids=None):
    """다음에 여는 영상부터 시작 시각을 새로 정함 -> 같이 도는 영상이 처음부터 같이 재생 (POST /control/plate/start)
    camera_ids: 이번에 도는 카메라들 (None 이면 config.CAMERAS 전부)"""
    with _sync_lock:
        _sync.update(epoch=None, period=None, cameras=set(camera_ids) if camera_ids is not None else None)


class VideoSource:
    """영상 파일은 실제 시간 속도로 반복 재생 (카메라끼리 시간을 맞춰서), rtsp 는 그대로 읽기"""

    def __init__(self, source, delay=0.0):
        self.is_file = "://" not in source
        self.path = _video_path(source) if self.is_file else source
        if self.is_file and not os.path.exists(self.path):
            raise FileNotFoundError(f"영상 파일이 없어요: {os.path.abspath(self.path)}")
        # 영상 풀기(디코딩)를 그래픽(내장 그래픽 포함)에 맡길지. 그래픽이 안 되는 PC면 자동으로 CPU로 풀어요.
        # 내장 그래픽 노트북은 CPU 가 더 빨라서 기본은 CPU (측정 720p: 그래픽 7.2ms / CPU 2.8ms,
        # 브라우저가 영상을 그리느라 그래픽이 바쁘면 그래픽 쪽은 21ms 까지 늘어서 스트림이 절반 fps 로 떨어졌어요)
        accel = cv2.VIDEO_ACCELERATION_ANY if config.VIDEO_HW_DECODE else cv2.VIDEO_ACCELERATION_NONE
        self.cap = cv2.VideoCapture(self.path, cv2.CAP_FFMPEG, [cv2.CAP_PROP_HW_ACCELERATION, accel])
        if not self.cap.isOpened():
            self.cap = cv2.VideoCapture(self.path)
        if not self.cap.isOpened():
            raise IOError(f"영상을 열 수 없어요: {self.path}")
        self.hw = self.cap.get(cv2.CAP_PROP_HW_ACCELERATION) > 0
        self.fps = self.cap.get(cv2.CAP_PROP_FPS) or 30
        self.delay = delay
        self.pos = 0                 # 다음에 읽을 프레임 번호
        self.ended = False           # 이번 바퀴에서 영상 끝까지 왔음 (다음 바퀴까지 마지막 화면 유지)
        self.still = None            # 기다리는 동안 보여줄 화면 (시작 전: 첫 화면, 끝난 뒤: 마지막 화면)
        self.ts = time.time()        # 마지막으로 읽은 화면의 시각
        if self.is_file:
            self.epoch, self.period = _sync_clock()
            self.cycle = int((time.time() - self.epoch) // self.period)   # 지금 몇 번째 바퀴인지

    def read(self):
        """'지금 시각'에 해당하는 프레임 하나. 파일은 건너뛸 프레임을 grab 으로 빠르게 넘겨요"""
        if not self.is_file:
            ok, frame = self.cap.read()
            self.ts = time.time()
            return frame if ok else None
        now = time.time()
        cycle = int((now - self.epoch) // self.period)
        start = self.epoch + cycle * self.period + self.delay  # 이 영상이 이번 바퀴에서 시작하는 시각 (모든 카메라 공통 기준)
        self.start = start
        target = int((now - start) * self.fps)
        if cycle != self.cycle:                                # 새 바퀴 -> 처음부터 다시
            self.cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
            self.cycle, self.pos, self.ended, self.still = cycle, 0, False, None
        if target < 0 or self.ended:                           # 시작 전(딜레이) / 끝난 뒤 -> 화면 멈춰서 기다림
            if self.still is None:
                ok, self.still = self.cap.read()
                if not ok:
                    return None
                self.pos = 1
            self.ts = now
            return self.still
        while self.pos < target:                    # 지나간 프레임은 그림으로 안 바꾸고 넘기기만
            if not self.cap.grab():
                return self._end(now)
            self.pos += 1
        ok, frame = self.cap.read()
        if not ok:
            return self._end(now)
        self.pos += 1
        self.still = frame                          # 영상이 끝나면 이 화면(마지막 화면)을 유지
        # 이 화면이 "원래 보여야 했던 시각". CPU가 바빠 읽기가 늦어져도 화면 내용과 시각이 어긋나지 않게
        self.ts = start + (self.pos - 1) / self.fps
        return frame

    def next_due(self):
        """다음 프레임을 읽기 딱 좋은 시각 (그 프레임 시간의 한가운데). 영상 파일만, 모르면 None
        이 시각에 맞춰 읽어야 프레임을 하나씩 차례로 읽어요. 아무 때나 읽으면 같은 장면을 두 번 보내거나
        한 장을 건너뛰어서 (측정: 1칸 65%, 2칸 22%, 반복 11%) 영상이 툭툭 끊겨 보여요"""
        if not self.is_file or self.ended or getattr(self, "start", None) is None:
            return None
        return self.start + (self.pos + 0.5) / self.fps

    def _end(self, now):
        """영상 끝 -> 다음 바퀴까지 마지막 화면 유지 (다른 카메라와 같이 처음으로 돌아가려고)"""
        self.ended, self.ts = True, now
        return self.still

    def release(self):
        self.cap.release()


_sent_log = {}   # 카메라 id -> deque[(전송 시각, 번호)]. 출구 카메라가 입구에서 보낸 번호를 찾을 때 씀


def _center(box):
    return ((box[0] + box[2]) / 2, (box[1] + box[3]) / 2)


def _match(p, plates):
    """다른 탐지 결과에서 같은 번호판 찾기 (네모 보간용). 엉뚱한 차와 짝지으면 네모가 튀어서 엄격하게:
      - 둘 다 글자가 있으면: 글자가 60% 이상 비슷한 것 중 가장 비슷하고 가까운 것 (거리 600px 이내)
      - 한쪽이라도 글자를 못 읽었으면: 아주 가까운 것만 (150px 이내)"""
    cx, cy = _center(p["box"])
    best, best_key = None, None
    for q in plates:
        qx, qy = _center(q["box"])
        d = ((qx - cx) ** 2 + (qy - cy) ** 2) ** 0.5
        if p["text"] and q["text"]:
            sim = SequenceMatcher(None, p["text"], q["text"]).ratio()
            if sim < 0.6 or d > 600:
                continue
            key = (-sim, d)
        else:
            if d > 150:
                continue
            key = (0, d)
        if best_key is None or key < best_key:
            best, best_key = q, key
    return best


def _track_match(boxes, known):
    """이번에 찾은 네모 중에 이미 전송한 차(known 의 예상 위치)와 같은 것 -> {네모 번호: known 항목}.
    엉뚱한 차를 이어 붙이면 그 차를 영영 안 읽으니까 엄격하게: 예상 위치에서 번호판 너비의 TRACK_MAX_DIST 배 안,
    크기 0.8~1.3배, 그리고 후보가 딱 하나일 때만 (front 영상 0.5초 간격 측정: 같은 차 최대 0.24배 / 다른 차 최소 2.6배)"""
    out, used = {}, set()
    for k in known:
        kx, ky = _center(k["box"])
        kw = k["box"][2] - k["box"][0]
        cands = [i for i, b in enumerate(boxes)
                 if 0.8 <= (b[2] - b[0]) / kw <= 1.3
                 and ((_center(b)[0] - kx) ** 2 + (_center(b)[1] - ky) ** 2) ** 0.5 <= config.TRACK_MAX_DIST * kw]
        if len(cands) == 1:
            if cands[0] in used:             # 두 차가 같은 네모를 가리킴 -> 헷갈리니까 그 네모는 OCR 로 읽음
                out.pop(cands[0], None)
            else:
                out[cands[0]] = k
            used.add(cands[0])
    return out


class CameraWorker:
    """카메라 하나 = 스레드 2개
      - capture_loop: 영상을 계속 읽고, 보는 사람이 있으면 네모 그린 화면(jpg)을 만들어 둠 (CCTV 스트림용)
      - detect_loop : PLATE_INTERVAL_SEC 마다 최신 화면으로 번호판 탐지 -> 확정된 번호만 Spring 전송
    둘을 나눠서, 탐지가 느려도(CPU 1~2초) 스트림 영상은 끊기지 않아요.

    [스트림 네모 위치 맞추기]
      CPU 탐지는 1~2초 걸려서 결과가 나올 때쯤 차는 이미 앞으로 가 있어요.
      그래서 스트림은 STREAM_DELAY_SEC 만큼 늦게 보여주고, 그 시각 앞뒤 탐지 결과 사이의 네모 위치를
      계산(보간)해서 그려요 -> 네모가 번호판을 따라다녀요."""

    def __init__(self, camera_id, source, reader):
        self.camera_id, self.source, self.reader = camera_id, source, reader
        self.frame, self.frame_ts = None, 0  # 가장 최근 원본 화면과 그 시각 (탐지용)
        self.frame_sec = None                # 그 화면이 영상 파일의 몇 초 지점인지 (rtsp 는 None)
        self.buffer = deque()                # 스트림용 (시각, 작게 줄인 화면) - 지연시켜 보여주려고 모아둠
        self.dets = deque(maxlen=20)         # 최근 탐지 결과 (화면 시각, 번호판 목록) - 네모 보간용
        self.jpg = None                      # 스트림용 최신 jpg (네모 그려진 것)
        self.waiters = set()                 # 새 jpg 를 기다리는 스트림들 (asyncio 루프, Event) -> 새 화면이 나오면 깨움
        self.shown_ts = 0.0                  # 마지막으로 스트림에 보낸 화면의 시각 (같은 화면 두 번 안 보내게)
        self.last_view = 0                   # 마지막으로 누가 스트림을 본 시각
        self.seen = {}                       # 번호 -> [처음 본 시각, 읽은 횟수]  (확정 전)
        self.last_sent = {}                  # 번호의 숫자 부분 -> 마지막 전송 시각
        _sent_log[camera_id] = deque(maxlen=200)   # 이 카메라가 보낸 번호 (출구 카메라가 참고)
        self.recent = deque(maxlen=30)       # 최근 전송 기록 (/plate/status 용)
        self.stats = {"frames": 0, "plates": 0, "ocrSkipped": 0, "sent": 0, "failed": 0}
        self.error = None
        self.running = False

    def status(self):
        return {"cameraId": self.camera_id, "source": self.source, "running": self.running,
                "error": self.error, "viewing": self.is_viewed(), **self.stats, "recent": list(self.recent)}

    def is_viewed(self):
        return time.time() - self.last_view < 3

    def start(self, stop_event):
        threading.Thread(target=self.capture_loop, args=(stop_event,), daemon=True).start()
        threading.Thread(target=self.detect_loop, args=(stop_event,), daemon=True).start()

    # ---------- 스트림용 화면 ----------
    def boxes_at(self, ts):
        """ts 시각의 번호판 네모들: 앞뒤 탐지 결과 사이를 보간. 뒤 결과가 없으면 앞 결과를 잠깐만 보여줌"""
        before = after = None
        for d in list(self.dets):
            if d[0] <= ts:
                before = d
            elif after is None:
                after = d
        out = []
        if before:
            t0, p0s = before
            for p in p0s:
                q = _match(p, after[1]) if after else None
                if q:                                        # 앞뒤 둘 다 있음 -> 사이 위치 계산
                    a = (ts - t0) / (after[0] - t0)
                    box = [round(b0 + (b1 - b0) * a) for b0, b1 in zip(p["box"], q["box"])]
                    out.append({**p, "box": box})
                elif ts - t0 < config.STREAM_BOX_HOLD_SEC:   # 다음 탐지에서 사라짐 -> 잠깐만 그대로
                    out.append(p)
        if after:                                            # 새로 나타난 번호판은 탐지 직전부터
            for q in after[1]:
                if after[0] - ts < config.STREAM_BOX_HOLD_SEC and not (before and _match(q, before[1])):
                    out.append(q)
        return out

    def render(self, small, ts, full_width, delayed=True):
        """작게 줄인 화면에 ts 시각의 네모 + 카메라 번호/시각 그리기"""
        s = small.shape[1] / full_width
        plates = [{**p, "box": [round(v * s) for v in p["box"]]} for p in self.boxes_at(ts)]
        img = draw(small, plates)
        label = f"CAM {self.camera_id}  {datetime.fromtimestamp(ts):%H:%M:%S}"
        if delayed:
            label += f"  (AI {config.STREAM_DELAY_SEC:.0f}s delay)"
        cv2.putText(img, label, (16, 36), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 0, 0), 5)
        cv2.putText(img, label, (16, 36), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (255, 255, 255), 2)
        return img

    def notify(self):
        """새 jpg 가 나왔다고 기다리는 스트림들을 깨움. 스트림이 자주 확인(폴링)하면 그때마다 파이썬 GIL 을 가져가서
        화면 만드는 스레드가 끊겨요 (측정: 0.01초마다 확인하면 보는 사람 1명 늘 때마다 fps 가 뚝 떨어짐)"""
        for loop, event in list(self.waiters):
            try:
                loop.call_soon_threadsafe(event.set)
            except RuntimeError:                 # 루프가 이미 닫힘 (스트림 끝남)
                self.waiters.discard((loop, event))

    @staticmethod
    def shrink(frame):
        h, w = frame.shape[:2]
        width = min(config.STREAM_WIDTH, w)
        return cv2.resize(frame, (width, int(h * width / w)))

    def capture_loop(self, stop_event):
        while not stop_event.is_set():
            try:
                video = VideoSource(self.source, config.VIDEO_DELAY_SEC.get(self.camera_id, 0))
            except Exception as e:
                self.error, self.running = str(e), False
                log.error("[카메라 %s] %s (30초 뒤 다시 시도)", self.camera_id, e)
                stop_event.wait(30)
                continue
            self.running, self.error = True, None
            log.info("[카메라 %s] 시작: %s (%.0ffps, %.1f초마다 탐지, 영상 풀기: %s, 딜레이 %.1f초)",
                     self.camera_id, self.source, video.fps, config.PLATE_INTERVAL_SEC, "그래픽" if video.hw else "CPU",
                     video.delay)
            try:
                while not stop_event.is_set():
                    started = time.time()
                    frame = video.read()
                    if frame is None:
                        raise IOError("프레임을 못 읽었어요 (카메라 연결 끊김?)")
                    now = video.ts                      # 화면 내용 기준 시각 (읽은 시각 아님)
                    self.frame, self.frame_ts = frame, now
                    self.frame_sec = max(video.pos - 1, 0) / video.fps if video.is_file else None
                    viewed = self.is_viewed()
                    if viewed:       # 아무도 안 보면 스트림 화면을 만들지 않음 (CPU 아끼기)
                        self.buffer.append((now, self.shrink(frame)))
                        # 지연 시각이 된 화면을 "아직 안 보낸 것 중 가장 앞"부터 하나씩 보냄.
                        # (시계로 매번 고르면 같은 화면을 두 번 보내거나 한 장씩 건너뛰어서 툭툭 끊겨 보임)
                        show_ts = time.time() - config.STREAM_DELAY_SEC + 0.5 / video.fps
                        frame_sec = 1 / video.fps
                        while len(self.buffer) > 1 and (self.buffer[0][0] <= self.shown_ts or
                                                        self.buffer[1][0] <= show_ts - 2 * frame_sec):
                            self.buffer.popleft()                 # 이미 보낸 화면 / 2장 넘게 밀린 화면은 버림
                        ts, small = self.buffer[0]
                        if ts != self.shown_ts and ts <= show_ts:
                            self.shown_ts = ts
                            self.jpg = to_jpg(self.render(small, ts, frame.shape[1]), config.STREAM_WIDTH,
                                              config.STREAM_QUALITY)
                            self.notify()
                    else:
                        self.buffer.clear()
                        self.shown_ts = 0.0
                    # 보는 사람이 있으면 초당 STREAM_FPS 장, 없으면 탐지에 필요한 만큼만 (0.5초마다)
                    interval = 1 / config.STREAM_FPS if viewed else 0.5
                    wait = interval - (time.time() - started)
                    due = video.next_due() if viewed else None
                    if due is not None:                  # 영상 파일을 보는 중: 다음 프레임 시각에 맞춰 깨어남
                        wait = min(due - time.time(), 1.0)
                    stop_event.wait(max(0.0, wait))
            except Exception as e:
                self.error = str(e)
                log.error("[카메라 %s] 오류: %s (5초 뒤 다시 연결)", self.camera_id, e)
                stop_event.wait(5)
            finally:
                self.running, self.frame = False, None
                self.buffer.clear()
                video.release()

    def snapshot(self):
        """지금 화면 jpg 한 장 (지연 없이 최신 화면 + 가장 최근 탐지 네모)"""
        frame, ts = self.frame, self.frame_ts
        if frame is None:
            return None
        return to_jpg(self.render(self.shrink(frame), ts, frame.shape[1], delayed=False),
                      config.STREAM_WIDTH, config.STREAM_QUALITY)

    # ---------- 번호판 탐지 + 전송 ----------
    @staticmethod
    def _key(text):
        """같은 차인지 비교할 때 쓰는 숫자 부분. 한글 한 글자만 다르게 읽은 건 같은 차로 봐요 (174어6751 = 174하6751)"""
        return re.sub(r"\D", "", text)

    def _entry_match(self, text, now):
        """출구 카메라면: 숫자 부분이 같은 번호를 최근 입구 카메라가 보냈는지 찾아서 그 번호를 돌려줘요"""
        entry_cam = config.EXIT_OF.get(self.camera_id)
        if entry_cam is None:
            return None
        key = self._key(text)
        for ts, entry_text in reversed(_sent_log.get(entry_cam, ())):
            if now - ts > config.EXIT_MATCH_SEC:
                break
            if self._key(entry_text) == key:
                return entry_text
        return None

    def _should_send(self, text, score, now):
        if now - self.last_sent.get(self._key(text), 0) < config.RESEND_SEC:
            return False                                     # 방금 보낸 차 (한글만 다르게 읽은 것 포함)
        if score >= config.INSTANT_SCORE:
            return True                                      # 아주 확실하면 바로
        first, count = self.seen.get(text, (now, 0))
        if now - first > config.CONFIRM_WINDOW_SEC:          # 오래전에 본 건 새로 셈
            first, count = now, 0
        self.seen[text] = [first, count + 1]
        return count + 1 >= config.CONFIRM_COUNT

    def _send(self, frame, p):
        now_str = datetime.now().strftime("%Y-%m-%dT%H:%M:%S")
        payload = {"cameraId": self.camera_id, "detectedNum": p["text"],
                   "confidence": round(min(max(p["score"], 0.0), 1.0), 3), "detectedAt": now_str}
        item = {"at": now_str, "text": p["text"], "score": p["score"]}
        try:
            res = spring.send_plate_log(payload, to_jpg(crop_plate(frame, p["box"])))   # 번호판 부분만
            item.update(plateLogId=res.get("id"), recognitionStatus=res.get("recognitionStatus"),
                        reviewStatus=res.get("reviewStatus"), imagePath=res.get("imagePath"))
            self.stats["sent"] += 1
            log.info("[카메라 %s] %s (%.3f) 전송 -> %s", self.camera_id, p["text"], p["score"],
                     res.get("recognitionStatus"))
        except Exception as e:
            item["error"] = str(e)
            self.stats["failed"] += 1
            log.warning("[카메라 %s] %s 전송 실패: %s", self.camera_id, p["text"], e)
        self.recent.appendleft(item)

    def known_plates(self, frame_ts):
        """이미 전송한 차들이 frame_ts 화면에 있을 위치 (reader.read 의 known).
        직전 탐지에서 본 위치 + 그 전 탐지와 비교한 속도로 계산. 속도를 모르는 차(한 번만 봄)는 빼서 그냥 OCR 로 읽어요"""
        if not config.TRACK_SKIP_OCR or not self.dets:
            return []
        dets = list(self.dets)
        t1, last = dets[-1]
        out = []
        for p in last:
            if not p["valid"] or self._key(p["text"]) not in self.last_sent:
                continue
            prev = next(((t0, q) for t0, plates in reversed(dets[:-1]) if 0 < t1 - t0 <= 2.0
                         for q in plates if q["valid"] and self._key(q["text"]) == self._key(p["text"])), None)
            if prev is None:
                continue
            t0, q = prev
            (x1, y1), (x0, y0) = _center(p["box"]), _center(q["box"])
            a = (frame_ts - t1) / (t1 - t0)              # 직전 두 번 사이 움직임을 시간 비율만큼 더 감
            dx, dy = (x1 - x0) * a, (y1 - y0) * a
            out.append({"box": [p["box"][0] + dx, p["box"][1] + dy, p["box"][2] + dx, p["box"][3] + dy],
                        "text": p["text"], "score": p["score"]})
        return out

    def detect_loop(self, stop_event):
        while not stop_event.is_set():
            started = time.time()
            frame, frame_ts, frame_sec = self.frame, self.frame_ts, self.frame_sec
            if frame is None:                                # 아직 영상이 안 열렸음
                stop_event.wait(1)
                continue
            try:
                self.detect_once(frame, frame_ts, frame_sec)
            except Exception as e:
                log.error("[카메라 %s] 탐지 오류: %s", self.camera_id, e)
            stop_event.wait(max(0.0, config.PLATE_INTERVAL_SEC - (time.time() - started)))

    def detect_once(self, frame, frame_ts, frame_sec, now=None):
        """화면 한 장: 번호판 찾기 + 읽기 -> 확정된 번호 전송. now: 시험용으로 시각을 정해 줄 때 (기본 지금)"""
        # 영상의 이 지점 이후는 출구 영상에 장면이 없어서 전송 안 함 (탐지와 화면 네모는 그대로)
        until = config.VIDEO_SEND_UNTIL_SEC.get(self.camera_id)
        can_send = until is None or frame_sec is None or frame_sec <= until
        plates = self.reader.read(frame, int(frame.shape[0] * config.DETECT_SKIP_TOP.get(self.camera_id, 0)),
                                  known=self.known_plates(frame_ts))
        self.dets.append((frame_ts, plates))         # "그 화면을 찍은 시각" 기준으로 저장 (보간용)
        self.stats["frames"] += 1
        self.stats["plates"] += len(plates)
        self.stats["ocrSkipped"] += sum(p["tracked"] for p in plates)   # 이미 보낸 차라서 OCR 건너뛴 네모
        now = time.time() if now is None else now
        for p in plates:
            if not (can_send and p["valid"] and p["score"] >= config.OCR_MIN_SCORE):
                continue
            entry = self._entry_match(p["text"], now)
            if entry:                                # 출구: 입구에서 보낸 차 -> 입구 번호로 바로 전송
                if now - self.last_sent.get(self._key(entry), 0) < config.RESEND_SEC:
                    continue
                if entry != p["text"]:
                    log.info("[카메라 %s] %s -> 입구 번호 %s 로 맞춤", self.camera_id, p["text"], entry)
                    p = {**p, "text": entry}
            elif not self._should_send(p["text"], p["score"], now):
                continue
            self.last_sent[self._key(p["text"])] = now
            self.seen.pop(p["text"], None)
            _sent_log[self.camera_id].append((now, p["text"]))
            self._send(frame, p)
        # 오래된 기록 정리 (메모리 계속 늘지 않게)
        self.seen = {t: v for t, v in self.seen.items() if now - v[0] <= config.CONFIRM_WINDOW_SEC}
        self.last_sent = {t: v for t, v in self.last_sent.items() if now - v < config.RESEND_SEC}
