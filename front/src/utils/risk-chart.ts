type Sample = Record<string, any>
export function riskTimestamp(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return NaN
  const normalized = value
    .trim()
    .replace(' ', 'T')
    .replace(/(\.\d{3})\d+/, '$1')
  return Date.parse(/(?:Z|[+-]\d{2}:?\d{2})$/.test(normalized) ? normalized : normalized + '+09:00')
}
// 시설 상세용: 왼쪽은 최근 pastMs 관측(bucketMs 평균), 가운데가 지금, 오른쪽은 앞으로 futureMs 예측.
// 두 구간은 시간 눈금이 달라서, 10초마다 쌓이는 관측이 몇 시간짜리 예측에 눌리지 않는다
export function riskSplitChart(
  history: Sample[],
  forecast: Sample[],
  o: {
    left: number; right: number; top: number; bottom: number; now: number
    split?: number; pastMs?: number; futureMs?: number; bucketMs?: number; maxGapMs?: number
  },
) {
  const split = o.split ?? 0.65, pastMs = o.pastMs ?? 3600000, futureMs = o.futureMs ?? 3 * 3600000
  const bucketMs = o.bucketMs ?? 60000, maxGap = o.maxGapMs ?? 5 * 60000
  const mid = o.left + (o.right - o.left) * split, from = o.now - pastMs, to = o.now + futureMs
  const read = (rows: Sample[], key: string) =>
    rows
      .filter((row) => (row.riskScore ?? row.score) != null && String(row.riskScore ?? row.score).trim() !== '')
      .map((row) => ({ at: riskTimestamp(row[key]), score: Number(row.riskScore ?? row.score) }))
      .filter((row) => Number.isFinite(row.at) && Number.isFinite(row.score))
      .map((row) => ({ at: row.at, score: Math.max(0, Math.min(100, row.score)) }))
  // 같은 1분에 든 관측은 평균 (시각도 평균이라 마지막 점이 지금보다 앞서지 않는다)
  const buckets = new Map<number, { at: number; score: number; n: number }>()
  for (const row of read(history, 'predictedAt')) {
    if (row.at < from || row.at > o.now) continue
    const key = Math.floor(row.at / bucketMs), b = buckets.get(key) || { at: 0, score: 0, n: 0 }
    buckets.set(key, { at: b.at + row.at, score: b.score + row.score, n: b.n + 1 })
  }
  const past = [...buckets.values()].map((b) => ({ at: b.at / b.n, score: b.score / b.n })).sort((a, b) => a.at - b.at)
  const unique = new Map<number, { at: number; score: number }>()
  for (const row of read(forecast, 'targetAt')) if (row.at > o.now && row.at <= to) unique.set(row.at, row)
  const future = [...unique.values()].sort((a, b) => a.at - b.at)
  const x = (at: number) =>
    at <= o.now ? o.left + ((at - from) / pastMs) * (mid - o.left) : mid + ((at - o.now) / futureMs) * (o.right - mid)
  const y = (score: number) => o.bottom - (score / 100) * (o.bottom - o.top)
  const path = (rows: { at: number; score: number }[], gap: number) =>
    rows.map((row, i) => `${!i || row.at - rows[i - 1]!.at > gap ? 'M' : 'L'}${x(row.at).toFixed(1)},${y(row.score).toFixed(1)}`).join(' ')
  const latest = past[past.length - 1]
  const format = (at: number) =>
    new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false }).format(at)
  const ticks = [from, from + pastMs / 2, o.now, o.now + 3600000, o.now + 2 * 3600000, o.now + 3 * 3600000]
    .filter((at) => at <= to)
    .map((at) => ({ x: x(at), label: format(at), now: at === o.now }))
  return {
    observedPath: path(past, maxGap),
    // 마지막 관측에서 첫 예측으로 이어 그린다
    forecastPath: path(latest && future.length ? [latest, ...future] : future, Infinity),
    forecastPoints: future.map((row) => ({ x: x(row.at), y: y(row.score), score: row.score })),
    latest: latest ? { x: x(latest.at), y: y(latest.score), score: latest.score } : null,
    mid, ticks, y, empty: !past.length && !future.length,
  }
}

export function riskChartSeries(
  history: Sample[],
  forecast: Sample[],
  left = 20,
  width = 260,
  bottom = 110,
  height = 100,
  options: { now?: number; maxGapMs?: number; extendToNow?: boolean; forecastGapMs?: number } = {},
) {
  const samples = (rows: Sample[], future: boolean) => {
    const unique = new Map<number, { at: number; score: number }>()
    for (const row of rows) {
      const at = riskTimestamp(future ? row.targetAt : row.predictedAt),
        score = row.riskScore ?? row.score
      if (
        Number.isFinite(at) &&
        score != null &&
        String(score).trim() !== '' &&
        Number.isFinite(Number(score))
      )
        unique.set(at, { at, score: Math.max(0, Math.min(100, Number(score))) })
    }
    return [...unique.values()].sort((a, b) => a.at - b.at)
  }
  const past = samples(history, false),
    latest = past[past.length - 1],
    predictions = samples(forecast, true)
  // Show near-term predictions on the same time scale, never backwards into observations.
  const anchor = latest?.at ?? predictions[0]?.at
  const future =
    anchor === undefined
      ? []
      : predictions.filter(
          (row) => (!latest || row.at > latest.at) && row.at <= anchor + 3 * 3600000,
        )
  const now = options.now ?? Date.now(),
    gap = options.maxGapMs ?? 30 * 60000
  const held =
    latest && options.extendToNow !== false && now > latest.at && now - latest.at <= gap
      ? { at: now, score: latest.score }
      : undefined
  const all = [...past, ...future, ...(held ? [held] : [])].sort((a, b) => a.at - b.at)
  if (!all.length)
    return {
      observed: '',
      forecast: '',
      observedPath: '',
      forecastPath: '',
      carryPath: '',
      ticks: [],
      boundary: null,
      lastObserved: null,
      samples: [],
    }
  const min = all[0]!.at,
    max = all[all.length - 1]!.at
  const x = (at: number) =>
    max === min ? left + width / 2 : left + ((at - min) / (max - min)) * width
  const y = (score: number) => bottom - (score / 100) * height
  const points = (rows: typeof past) => rows.map((row) => `${x(row.at)},${y(row.score)}`).join(' ')
  const path = (rows: typeof past, maxGap: number) =>
    rows
      .map(
        (row, index) =>
          `${!index || row.at - rows[index - 1]!.at > maxGap ? 'M' : 'L'}${x(row.at)},${y(row.score)}`,
      )
      .join(' ')
  const forecastRows =
    future.length && latest
      ? [latest, ...(held && held.at < future[0]!.at ? [held] : []), ...future]
      : future
  // Always bridge the last observation to the first forecast; split only gaps within forecasts.
  const forecastPath = forecastRows
    .map(
      (row, index) =>
        `${!index ? 'M' : index === 1 && latest ? 'L' : row.at - forecastRows[index - 1]!.at > (options.forecastGapMs ?? 3 * 3600000) ? 'M' : 'L'}${x(row.at)},${y(row.score)}`,
    )
    .join(' ')
  const format = (at: number) =>
    new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(at)
  const ticks = (max === min ? [min] : [min, min + (max - min) / 2, max]).map((at) => ({
    x: x(at),
    label: format(at),
  }))
  return {
    observedPath: path(past, gap),
    forecastPath,
    carryPath: held && latest ? path([latest, held], Infinity) : '',
    samples: past.map((row) => ({
      x: x(row.at),
      y: y(row.score),
      score: row.score,
      time: new Date(row.at).toISOString(),
    })),
    observed: points(past),
    forecast: points(future.length && latest ? [latest, ...future] : future),
    ticks,
    boundary: latest && future.length ? x(latest.at) : null,
    lastObserved: latest
      ? { x: x(latest.at), y: y(latest.score), score: latest.score, label: format(latest.at) }
      : null,
  }
}
