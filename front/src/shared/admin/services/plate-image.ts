/** Accept both relative upload names and server-provided upload URLs. */
export function plateImageUrl(path: string): string {
  const value = path.trim().replace(/\\/g, '/')
  if (/^https?:\/\//i.test(value)) return value
  if (value.startsWith('/api/uploads/')) return value
  return '/api/uploads/' + value.replace(/^\/?uploads\//, '').replace(/^\/+/, '')
}
