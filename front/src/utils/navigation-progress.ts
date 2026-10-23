import type { Point } from '../services/navigation'
export function distanceMeters(a: Point, b: Point) {
  const rad = Math.PI / 180,
    lat = ((a.lat + b.lat) / 2) * rad
  return Math.hypot((a.lng - b.lng) * 111320 * Math.cos(lat), (a.lat - b.lat) * 111320)
}
export function projectRoute(points: Point[], position: Point) {
  let total = 0,
    progress = 0,
    distance = Infinity
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!,
      b = points[i]!,
      sx = 111320 * Math.cos((position.lat * Math.PI) / 180),
      sy = 111320
    const ax = (a.lng - position.lng) * sx,
      ay = (a.lat - position.lat) * sy,
      dx = (b.lng - a.lng) * sx,
      dy = (b.lat - a.lat) * sy
    const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy || 1))),
      length = Math.hypot(dx, dy),
      gap = Math.hypot(ax + t * dx, ay + t * dy)
    if (gap < distance) {
      distance = gap
      progress = total + t * length
    }
    total += length
  }
  return { total, progress, distance, remaining: Math.max(0, total - progress) }
}
export function formatDistance(meters: number) {
  return meters >= 1000
    ? `${(meters / 1000).toFixed(1)} km`
    : `${Math.max(0, Math.round(meters / 10) * 10)} m`
}
