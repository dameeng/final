/** Use the last real observation in each time bucket; never fill gaps. */
export function buildRiskTrend(rows: { predictedAt?: string; riskScore?: number | null }[], intervalMinutes = 5, viewportWidth = 640) {
  const INTERVAL = intervalMinutes * 60 * 1000
  const buckets = new Map<number, { time: string; timestamp: number; score: number }>()
  for (const row of rows) {
    const timestamp = Date.parse(row.predictedAt || '')
    if (!Number.isFinite(timestamp) || row.riskScore == null || !Number.isFinite(Number(row.riskScore))) continue
    const bucket = Math.floor(timestamp / INTERVAL) * INTERVAL
    if (!buckets.has(bucket) || buckets.get(bucket)!.timestamp <= timestamp) {
      buckets.set(bucket, { time: row.predictedAt!, timestamp, score: Number(row.riskScore) })
    }
  }
  const latest=Math.max(0,...buckets.keys());
  const times = [...buckets.keys()].filter(t=>t>=latest-12*3600000).sort((a,b) => a-b)
  const first = times[0] ?? 0
  const slots = times.length ? (times.at(-1)! - first) / INTERVAL : 0
  const width = Math.max(640, Math.round(viewportWidth), slots * 8 + 64)
  const x = (time: number) => slots ? 40 + (time-first) / INTERVAL / slots * (width-64) : width/2
  const points = times.map(bucket => ({ ...buckets.get(bucket)!, bucket, x:x(bucket), y:130-Math.max(0,Math.min(100,buckets.get(bucket)!.score)) }))
  const paths: string[] = []
  let path = ''
  points.forEach((point,i) => {
    const previous = points[i-1]
    if (!previous || point.bucket-previous.bucket !== INTERVAL) {
      if (path) paths.push(path)
      path = `M ${point.x} ${point.y}`
    } else {
      // Horizontal tangents round each join without overshooting either score.
      const middle = (previous.x+point.x)/2
      path += ` C ${middle} ${previous.y}, ${middle} ${point.y}, ${point.x} ${point.y}`
    }
  })
  if (path) paths.push(path)
  const ticks = Array.from({length:times.length ? slots+1 : 0},(_,i) => {
    const time = first+i*INTERVAL
    return {time,x:x(time),label:new Date(time).toLocaleTimeString('ko-KR',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',hour12:false})}
  })
  return {width,points,paths,ticks:ticks.filter((_,i)=>i%Math.max(1,Math.ceil(ticks.length/6))===0 || i===ticks.length-1)}
}
