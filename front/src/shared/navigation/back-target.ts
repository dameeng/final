export type NavigationArea = 'web' | 'app' | 'admin' | 'mobile'

export function fallbackTarget(area: NavigationArea, path: string, kind?: unknown): string {
  if (area === 'web') {
    if (path.startsWith('/info/notices/')) return '/info/notices'
    if (path.startsWith('/info/faq/')) return '/info/faq'
    return path === '/signup' ? '/login' : '/'
  }
  if (area === 'app') {
    if (path.startsWith('/underpasses/')) return '/underpasses'
    if (path.startsWith('/notices/')) return '/notices'
    return path === '/signup' ? '/login' : '/'
  }
  if (area === 'mobile') return path.startsWith('/mobile/facilities/') ? '/mobile/facilities' : '/mobile'
  const scope = path.startsWith('/regional/') ? '/regional' : path.startsWith('/super/') ? '/super' : ''
  if (path.endsWith('/notices/new')) return scope ? `${scope}/customers?tab=${scope === '/regional' && kind === 'FAQ' ? 'faq' : 'notices'}` : '/notices'
  if (path.includes('/inquiries/')) return scope ? `${scope}/customers?tab=opinions` : '/opinions'
  if (/^\/(regional\/|super\/)?facilities\//.test(path)) return `${scope}/facilities`
  return path === '/signup' ? '/login' : '/dashboard'
}

export function isUsablePrevious(value: unknown, current: string): value is string {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') && !value.includes('\\') && value !== current && !/^\/(?:mobile\/)?(?:login|signup)(?:[/?#]|$)/.test(value)
}
