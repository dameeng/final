"""실제 모델·SpringClient·Runner를 사용하고 Spring HTTP/DB만 메모리로 대체한다.
실행: pm_server 폴더에서 python -m unittest discover -s tests -v
"""
import copy
import json
import threading
import unittest
import warnings
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from unittest.mock import patch
from urllib.parse import parse_qs, urlsplit

import numpy as np
import pandas as pd

from pdm.features import SPECS, TIME_COL
from pdm.model import Models
from pdm.runner import Runner
from pdm.spring_client import SpringClient


class FakeSpring:
    def __init__(self):
        self.eqs, self.frames, self.posts, self.stored, self.gets = [], {}, [], {}, []
        self.fail_next = False
        end = pd.Timestamp('2026-10-25T12:00:00')
        rng = np.random.default_rng(42)
        for eid, typ in enumerate(('PUMP', 'CCTV', 'WATER_LEVEL', 'DISPLAY'), 1):
            step = {'PUMP': 10, 'CCTV': 3600, 'WATER_LEVEL': 300, 'DISPLAY': 3600}[typ]
            n = {'PUMP': 100, 'CCTV': 48, 'WATER_LEVEL': 865, 'DISPLAY': 45 * 24}[typ]
            ts = pd.date_range(end=end, periods=n, freq=pd.Timedelta(seconds=step))
            # 백필의 평소 값과 이상 값 범위를 사용. 모델 재학습이나 점수 조작은 하지 않는다.
            z = lambda: (rng.random(n) + rng.random(n) + rng.random(n) - 1.5) * 2
            ramp = np.clip(np.linspace(-2, 1, n), 0, 1)
            if typ == 'PUMP':
                s = .3 * ramp
                vals = dict(vibration=980+2*z()-850*s, pressure=1013+14*z()-250*s,
                            temperature=2.505+.015*z()-.6*s, current=np.maximum(0, 1.1+.3*z()+14*s),
                            flow=36.2+1.8*z()-4.5*s, rpm=38+3*z()-6*s)
            elif typ == 'CCTV':
                s = .1 * ramp
                vals = dict(video_receive_rate=np.clip(99+.65*z()-7.5*s, 0, 100),
                            response_time_ms=np.maximum(0, 48.7+5.8*z()+47*s),
                            packet_loss_rate=np.maximum(0, .18+.19*z()+2.2*s),
                            image_blur_score=np.maximum(0, 6.6+3.5*z()+31*s))
            elif typ == 'WATER_LEVEL':
                # 마지막 두 시간에 급변하는 백필 시나리오
                s = np.clip((np.arange(n)-(n-25))/24, 0, 1)**1.6*.5
                vals = dict(level_m=.30+.02*np.sin(2*np.pi*(ts.hour+ts.minute/60-6)/24)
                            + .004*z()*(1+10*s)+.5*s)
            else:
                s = np.clip((np.arange(n)-(n-145))/144, 0, 1)**1.6*.4
                ambient = 18+7*np.sin(2*np.pi*(ts.hour-9)/24)+z()
                vals = dict(ambient_c=ambient, temperature_c=ambient+6.5+.6*z()+9*s,
                            ripple_v=np.maximum(0, .028+.004*z()), response_time_ms=43+5*z(),
                            error_count=np.zeros(n, dtype=int), bad_pixel_pct=np.maximum(0, .015+.003*z()))
            self.frames[eid] = pd.DataFrame({TIME_COL[typ]: ts, **vals})
            self.eqs.append(dict(equipId=eid, type=typ, name=typ, underpassId=1,
                                 underpassName='테스트', sensorIntervalSec=step,
                                 dataStartedAt=ts[0].isoformat(), lastSensorAt=end.isoformat()))
        fake = self

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *_):
                pass

            def reply(self, data, code=200):
                body = json.dumps(dict(success=200 <= code < 300, data=data, message='test'), ensure_ascii=False).encode()
                self.send_response(code)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Content-Length', str(len(body)))
                self.end_headers()
                self.wfile.write(body)

            def do_GET(self):
                if self.headers.get('X-Internal-Api-Key') != 'test-key':
                    return self.reply({}, 401)
                path = urlsplit(self.path)
                fake.gets.append(path.path)
                if path.path.endswith('/equipments'):
                    return self.reply(fake.eqs)
                q = parse_qs(path.query)
                series = []
                for eid in map(int, q['equipIds'][0].split(',')):
                    eq = next(e for e in fake.eqs if e['equipId'] == eid)
                    typ, df = eq['type'], fake.frames[eid]
                    tc = TIME_COL[typ]
                    for param, op in [('from', 'ge'), ('to', 'lt'), ('after', 'gt')]:
                        if param in q:
                            df = df[getattr(df[tc], op)(pd.Timestamp(q[param][0]))]
                    buckets = []
                    for _, row in df.iterrows():
                        cols = {}
                        for c in SPECS[typ]['metrics']:
                            v = float(row[c])
                            cols[c] = dict(count=1, sum=v, sumSq=v*v, min=v, max=v)
                        buckets.append(dict(t=row[tc].isoformat(), n=1, cols=cols))
                    series.append(dict(equipId=eid, buckets=buckets))
                self.reply(dict(series=series, truncated=False, unknownEquipIds=[], nextAfter=None))

            def do_POST(self):
                if self.headers.get('X-Internal-Api-Key') != 'test-key':
                    return self.reply({}, 401)
                body = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
                if fake.fail_next:
                    fake.fail_next = False
                    return self.reply({}, 503)
                fake.posts.append(body)
                saved = 0
                for item in body['scores']:
                    key = (item['equipId'], item['predictedAt'])
                    if key not in fake.stored:
                        fake.stored[key] = copy.deepcopy(item)
                        saved += 1
                    eq = next((e for e in fake.eqs if e['equipId'] == item['equipId']), None)
                    if eq is not None:
                        eq['lastScoreAt'] = max(eq.get('lastScoreAt') or '', item['predictedAt'])
                self.reply(dict(saved=saved, duplicated=len(body['scores'])-saved, unknownEquipments=0), 201)

        self.server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def close(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()

    def advance(self, eid, count=1):
        eq = next(e for e in self.eqs if e['equipId'] == eid)
        tc = TIME_COL[eq['type']]
        for _ in range(count):
            row = self.frames[eid].iloc[-1].copy()
            row[tc] += pd.Timedelta(seconds=eq['sensorIntervalSec'])
            # 새 측정값도 조금씩 달라진다.
            metric = next(iter(SPECS[eq['type']]['metrics']))
            row[metric] *= 1.0001
            self.frames[eid] = pd.concat([self.frames[eid], row.to_frame().T], ignore_index=True)
        eq['lastSensorAt'] = row[tc].isoformat()


class LiveLinkTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with warnings.catch_warnings(record=True) as caught:
            warnings.simplefilter('always')
            cls.models = Models()
        cls.model_warnings = sorted({str(w.message).split('.')[0] for w in caught})
        if len(cls.models.bundles) != 4:
            raise AssertionError(cls.models.errors)

    def setUp(self):
        self.spring = FakeSpring()
        self.client = SpringClient('http://127.0.0.1:%d' % self.spring.server.server_port, 'test-key')
        self.runner = Runner(self.models, self.client)

    def tearDown(self):
        self.spring.close()

    def test_real_models_send_scores_reasons_and_incremental_updates(self):
        self.assertEqual(self.runner.cycle(), 4, self.runner.info)
        self.assertEqual(self.runner.info['lastStatuses'], {i: 'ok' for i in range(1, 5)})
        for item in self.spring.posts[-1]['scores']:
            self.assertTrue(0 <= item['score'] <= 100)
            self.assertIsInstance(item['reasons'], list)
            self.assertTrue(item['detail']['features'])
            self.assertEqual(item['predictedAt'], '2026-10-25T12:00:00')
        self.assertTrue(any(x['reasons'] for x in self.spring.posts[-1]['scores']))
        print('\nactual model outputs:', [(x['type'], x['score'], x['reasons']) for x in self.spring.posts[-1]['scores']])
        before = len(self.spring.gets)
        self.assertEqual(self.runner.cycle(), 0)
        self.assertEqual(self.spring.gets[before:], ['/api/internal/pm/equipments'])
        for eid in range(1, 5):
            self.spring.advance(eid)
            self.assertEqual(self.runner.cycle(), 1, self.runner.info)
            self.assertEqual(self.spring.posts[-1]['scores'][0]['equipId'], eid)
            self.assertEqual(self.spring.posts[-1]['scores'][0]['predictedAt'],
                             self.spring.eqs[eid-1]['lastSensorAt'])
        self.assertEqual(len(self.spring.stored), 8)

    def test_failed_post_retries_without_new_sensor(self):
        self.spring.fail_next = True
        self.runner.cycle()
        self.assertTrue(self.runner.info['lastError'])
        self.assertEqual(len(self.runner.pending), 4)
        self.assertEqual(self.runner.cycle(), 4)
        self.assertEqual(len(self.spring.stored), 4)
        self.assertFalse(self.runner.pending)
        self.assertIsNone(self.runner.info['lastError'])

    def test_heartbeat_and_deleted_equipment(self):
        self.runner.cycle()
        self.runner.last_post_at -= 61
        self.assertEqual(self.runner.cycle(), 1)
        self.assertTrue(self.runner.info['heartbeat'])
        self.assertEqual(len(self.spring.stored), 4)  # 중복은 추가 저장하지 않음
        self.spring.eqs = self.spring.eqs[1:]
        self.runner.last_post_at -= 61
        self.runner.cycle()
        self.assertNotIn(1, self.runner.latest)
        self.assertNotIn(1, [x['equipId'] for x in self.spring.posts[-1]['scores']])

    def test_missing_history_is_not_invented(self):
        for eid in range(1, 5):
            self.spring.frames[eid] = self.spring.frames[eid].tail(1)
        self.assertEqual(self.runner.cycle(), 0)
        self.assertFalse(self.spring.posts)
        self.assertTrue(all(s != 'ok' for s in self.runner.info['lastStatuses'].values()))

    def test_startup_backfill_skips_equipment_with_existing_scores(self):
        for eq in self.spring.eqs:
            eq['lastScoreAt'] = eq['lastSensorAt']
        self.runner.backfill()
        self.assertEqual(self.runner.info['backfill']['state'], 'done')
        self.assertEqual(self.runner.info['backfill']['skippedExisting'], 4)
        self.assertEqual(self.runner.info['backfill']['computed'], 0)
        self.assertFalse(self.spring.posts)
        self.assertEqual(self.spring.gets, ['/api/internal/pm/equipments'])

    def test_backfill_only_missing_equipment_and_manual_force(self):
        for eq in self.spring.eqs:
            eq['lastScoreAt'] = eq['lastSensorAt']
        self.spring.eqs[2].pop('lastScoreAt')
        self.runner.backfill_days = 1
        self.runner.backfill_step_min = 1440
        self.runner.backfill()
        bf = self.runner.info['backfill']
        self.assertEqual(bf['state'], 'done', bf)
        self.assertEqual(bf['skippedExisting'], 3)
        self.assertTrue(self.spring.posts)
        self.assertTrue(all(i['equipId'] == 3 for p in self.spring.posts for i in p['scores']))
        self.assertTrue(all(p['backfill'] for p in self.spring.posts))
        self.runner.backfill(force=True)
        bf = self.runner.info['backfill']
        self.assertEqual(bf['state'], 'done', bf)
        self.assertEqual(bf['skippedExisting'], 0)
        self.assertTrue(bf['force'])
        self.assertGreater(bf['computed'], 1)

    def test_reset_and_faster_poll_default(self):
        self.assertEqual(self.runner.poll_sec, 10)
        self.runner.cycle()
        self.runner.reset()
        self.assertFalse(self.runner.latest)
        self.assertFalse(self.runner.pending)
        self.assertIsNone(self.runner.last_post_at)


if __name__ == '__main__':
    unittest.main()
