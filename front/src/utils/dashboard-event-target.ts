export function dashboardEventTarget(event: Record<string, any>) {
  return event.underpassId != null
    ? { path:'/logs', query:{ underpassId:String(event.underpassId) } }
    : { path:'/admin-reports', query:{ report:'timeline' } }
}
