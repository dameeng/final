import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'
const b = await chromium.launch({
  headless: true,
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
})
try {
  const p = await b.newPage()
  for (const width of [1920, 1440, 1280, 768, 390, 360]) {
    await p.setViewportSize({ width, height: 900 })
    await p.goto('http://localhost:8282/info/company')
    const overlaps = await p
      .locator('.customer-header a,.customer-header button')
      .evaluateAll((els) =>
        els
          .filter((el) => {
            if (el.closest('#customer-header-dropdown')) return false
            const r = el.getBoundingClientRect()
            if (!r.width || !r.height) return false
            const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
            return !el.contains(hit)
          })
          .map((el) => el.textContent),
      )
    assert.deepEqual(overlaps, [], 'blocked header controls at ' + width)
    console.log('PASS accessible header at', width)
  }
} finally {
  await b.close()
}
