import type { Underpass } from './underpasses'
export type ManagerProfile = { id?: number; loginId?: string; email?: string; phone?: string; department?: string; position?: string; name: string; role: string; regionName: string | null; regionId: number | null }
export function belongsToRegion(item: Underpass, profile: ManagerProfile | null): boolean {
  if (!profile || profile.role !== 'REGIONAL_ADMIN') return false
  if (profile.regionId == null) return false
  return item.regionId != null
    ? String(item.regionId) === String(profile.regionId)
    : Boolean(profile.regionName && item.region === profile.regionName)
}
export function regionalRouteAllowed(path: string): boolean {
  return /^\/regional\/customers\/inquiries\/[^/]+$/.test(path) || ['/regional/facilities', '/regional/customers', '/regional/logs'].includes(path) || /^\/regional\/facilities\/[^/]+$/.test(path)
    || ['/regional/notices/new', '/plate-logs', '/dashboard', '/facilities', '/cctv', '/operations', '/pump-risk', '/alert-evidence', '/logs', '/profile'].includes(path)
    || /^\/facilities\/[^/]+(?:\/(?:cctv|operations))?$/.test(path)
}
