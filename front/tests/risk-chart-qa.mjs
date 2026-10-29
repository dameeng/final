import assert from 'node:assert/strict'
import { createServer } from 'vite'
const server = await createServer({ configLoader: 'runner', server: { middlewareMode: true } })
try {
  const { riskChartSeries, riskSplitChart } = await server.ssrLoadModule('/src/utils/risk-chart.ts')
  const history = [
    { predictedAt: '2026-10-21T12:00:00', riskScore: 10 },
    { predictedAt: '2026-10-21T11:00:00', riskScore: 8 },
    { predictedAt: '2026-10-21T12:00:00', riskScore: 12 },
  ]
  const forecast = [
    { targetAt: '2026-10-21T11:30:00', riskScore: 40 },
    { targetAt: '2026-10-21T13:00:00', riskScore: 20 },
    { targetAt: '2026-10-21T15:00:00', riskScore: 30 },
    { targetAt: '2026-10-21T18:00:00', riskScore: 70 },
  ]
  const chart = riskChartSeries(history, forecast, 20, 260, 110, 100, { extendToNow: false })
  assert.equal(
    chart.observed,
    '20,102 85,98',
    'sorted, deduplicated observations keep the 0–100 scale',
  )
  assert.equal(
    chart.forecast,
    '85,98 150,90 280,80',
    'forecast starts at last observation, excludes stale and distant predictions',
  )
  assert.equal(chart.boundary, 85)
  assert.deepEqual(
    chart.ticks.map((t) => t.label),
    ['11:00', '13:00', '15:00'],
  )
  assert.equal(
    riskChartSeries([{ predictedAt: '2026-10-21T03:00:00Z', riskScore: 12 }], []).lastObserved
      .label,
    '12:00',
  )
  assert.equal(
    riskChartSeries(
      [{ predictedAt: '2026-10-21T12:00:00', riskScore: 12 }],
      [],
      20,
      260,
      110,
      100,
      { extendToNow: false },
    ).lastObserved.x,
    150,
    'single observation remains visible in the center',
  )
  assert.equal(
    riskChartSeries(
      [
        { predictedAt: 'bad', riskScore: 8 },
        { predictedAt: '2026-10-21T12:00:00', riskScore: '' },
      ],
      [],
    ).observed,
    '',
  )
  assert.equal(riskChartSeries([], forecast).boundary, null)
  const start = Date.parse('2026-10-21T03:00:00Z'),
    sample = (seconds, score = 10) => ({
      predictedAt: new Date(start + seconds * 1000).toISOString(),
      riskScore: score,
    })
  const irregular = riskChartSeries([sample(0), sample(10), sample(310)], [], 0, 310, 100, 100, {
    extendToNow: false,
  })
  assert.deepEqual(
    irregular.samples.map((p) => p.x),
    [0, 10, 310],
    '10 seconds and 5 minutes have proportional horizontal spacing',
  )
  assert.equal((irregular.observedPath.match(/M/g) || []).length, 1, 'short gaps stay connected')
  const missing = riskChartSeries(
    [sample(0), { ...sample(20), riskScore: null }, sample(300), sample(2400)],
    [],
    0,
    2400,
    100,
    100,
    { extendToNow: false },
  )
  assert.equal(
    (missing.observedPath.match(/M/g) || []).length,
    2,
    'skip invalid samples, break only gaps longer than 30 minutes',
  )
  const recent = riskChartSeries(
    [sample(0), sample(300, 25)],
    [{ targetAt: new Date(start + 3600000).toISOString(), riskScore: 40 }],
    0,
    3600,
    100,
    100,
    { now: start + 600000 },
  )
  assert.equal(
    recent.carryPath,
    'M300,75 L600,75',
    'last known value extends horizontally, separate from real measurements',
  )
  assert.equal(recent.samples.length, 2, 'carry does not fabricate measured data')
  assert.equal(
    recent.forecastPath,
    'M300,75 L600,75 L3600,60',
    'forecast connects last observation through held value to first forecast',
  )
  assert.equal(
    riskChartSeries([sample(0)], [], 0, 100, 100, 100, { now: start + 3600000 }).carryPath,
    '',
    'stale values never extend indefinitely',
  )
  const daily = riskChartSeries(
    [sample(0), sample(86400), sample(4 * 86400)],
    [],
    0,
    400,
    100,
    100,
    { extendToNow: false, maxGapMs: 36 * 3600000 },
  )
  assert.deepEqual(
    daily.samples.map((p) => p.x),
    [0, 100, 400],
    'daily aggregate time gaps stay proportional',
  )
  // 시설 상세: 최근 1시간 관측(1분 평균) | 지금 | 3시간 예측 (구간마다 시간 눈금이 다르다)
  const now = Date.parse('2026-10-21T12:00:00+09:00')
  const at = (ms) => new Date(now + ms).toISOString()
  const split = riskSplitChart(
    [
      { predictedAt: at(-2 * 3600000), riskScore: 99 },
      { predictedAt: at(-30 * 60000 - 20000), riskScore: 10 },
      { predictedAt: at(-30 * 60000 - 10000), riskScore: 20 },
      { predictedAt: at(-10000), riskScore: 60 },
      { predictedAt: at(0), riskScore: null },
    ],
    [
      { targetAt: at(-3600000), riskScore: 1 },
      { targetAt: at(3600000), riskScore: 70 },
      { targetAt: at(4 * 3600000), riskScore: 90 },
    ],
    { left: 0, right: 100, top: 0, bottom: 100, now },
  )
  assert.equal(split.mid, 65, 'now line splits observed and forecast areas')
  assert.equal(split.observedPath.split(/[ML]/).filter(Boolean).length, 2, 'older than 1h dropped, same minute averaged')
  assert.ok(split.observedPath.includes(',85.0'), 'scores 10 and 20 in one minute average to 15')
  assert.equal(split.latest.score, 60, 'latest observation ends at now')
  assert.deepEqual(split.forecastPoints.map((p) => p.score), [70], 'only forecasts after now within 3h')
  assert.ok(Math.abs(split.forecastPoints[0].x - (65 + 35 / 3)) < 1e-9, 'forecast uses its own 3h time scale')
  assert.equal(split.ticks.find((t) => t.now)?.label, '12:00', 'now tick shows current Korean time')
  assert.equal(riskSplitChart([], [], { left: 0, right: 100, top: 0, bottom: 100, now }).empty, true)
  console.log(
    'PASS risk chart: chronological order, duplicate timestamps, Korean timezone, near-term horizon, no backward forecast, exact scores and visible single point, split observed/forecast chart',
  )
} finally {
  await server.close()
}
