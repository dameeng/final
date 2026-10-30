import { spawn } from 'node:child_process'
import { createServer } from 'vite'
let server
try {
  await fetch('http://localhost:8282')
} catch {
  server = await createServer({ configLoader: 'runner' })
  await server.listen()
}
try {
  for (const file of [
    'contacts-account.mjs',
    'notification-sensor.mjs',
    'fixed-dashboard.mjs',
    'backend-integration.mjs',
    'backend-auth-flows.mjs',
    'admin-control-stability.mjs',
    'facility-risk-filter.mjs',
    'admin-list-presentation.mjs',
    'summary-card-layout.mjs',
    'manager-profile-presentation.mjs',
    'cctv-workspace-layout.mjs',
    'facility-settings-layout.mjs',
    'map-early-block-badge.mjs',
    'facility-select.mjs',
    'admin-handover.mjs',
    'header-responsive.mjs',
    'layout-fixes.mjs',
    'customer-map-sheet.mjs',
  ]) {
    const code = await new Promise((resolve) => {
      const child = spawn(process.execPath, ['tests/' + file], { stdio: 'inherit' })
      child.on('exit', resolve)
    })
    if (code !== 0) {
      process.exitCode = 1
      break
    }
  }
} finally {
  await server?.close()
}
