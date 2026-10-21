import { chromium } from '@playwright/test'
const b = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
})
const p = await b.newPage({ viewport: { width: 390, height: 900 } })
for (const [name, path] of [
  ['dashboard', '/admin-dashboard'],
  ['customer', '/c-map'],
  ['app', '/customer-app/screen-5'],
]) {
  await p.addInitScript(() =>
    localStorage.setItem(
      'routel-handover-hide:guest:regional',
      new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date()),
    ),
  )
  await p.goto('http://localhost:8282' + path)
  await p.waitForTimeout(300)
  await p.screenshot({ path: 'test-results/' + name + '-mobile.png', fullPage: true })
}
await b.close()
