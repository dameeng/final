const appPaths: Record<string, string> = {
  '/fac-detail': '/admin-app/screen-5',
  '/pm-equipment': '/admin-app/screen-9',
  '/pm-equipment-detail': '/admin-app/screen-10',
  '/pm-queue': '/admin-app/screen-11',
  '/pm-inspection': '/admin-app/inspection',
  '/pm-history': '/admin-app/history',
  '/admin-data/ocr': '/admin-app/ocr',
  '/admin-data/notices': '/admin-app/notices',
  '/admin-data/inquiries': '/admin-app/inquiries',
}

export function managerAppPath(path: string, currentPath: string): string {
  return currentPath.startsWith('/admin-app/') ? appPaths[path] || path : path
}
