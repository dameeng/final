import { chromium } from '@playwright/test'
import { createServer } from 'vite'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
let server
try {
  await fetch('http://localhost:8282')
} catch {
  server = await createServer({ configLoader: 'runner' })
  await server.listen()
}
const paths = [
  ...new Set(
    [...readFileSync('src/router.ts', 'utf8').matchAll(/path:'([^':?()]+)'/g)].map((m) => m[1]),
  ),
]
const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
})
const issues = []
mkdirSync('test-results', { recursive: true })
try {
  const p = await browser.newPage()
  let errors = []
  p.on('pageerror', (e) => errors.push(e.message))
  for (const width of process.argv[2] ? process.argv[2].split(',').map(Number) : [1440, 768, 390]) {
    await p.setViewportSize({ width, height: 900 })
    for (const path of paths) {
      errors = []
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
      await p.waitForTimeout(65)
      const result = await p.evaluate(() => {
        const width = document.documentElement.clientWidth
        return {
          overflow: document.documentElement.scrollWidth - width,
          offenders: [...document.querySelectorAll('body *')]
            .filter((el) => {
              const r = el.getBoundingClientRect(),
                s = getComputedStyle(el)
              return (
                r.width &&
                r.right > width + 2 &&
                r.left >= 0 &&
                s.position !== 'fixed' &&
                !el.closest(
                  '.customer-header-scroll,.side,.drawer,dialog,svg,.real-map-host,.tbl-wrap,.table-wrap',
                )
              )
            })
            .slice(0, 12)
            .map((el) => ({
              tag: el.tagName,
              cls: el.className,
              right: Math.round(el.getBoundingClientRect().right),
            })),
        }
      })
      if (result.overflow > 2 || errors.length)
        issues.push({ path, width, ...result, errors: [...errors] })
    }
    console.log('checked', width, paths.length, 'routes; issues', issues.length)
  }
  writeFileSync('test-results/layout-audit.json', JSON.stringify(issues, null, 2))
  if (issues.length) process.exitCode = 1
  console.log(
    JSON.stringify(
      issues.map(({ path, width, overflow, errors }) => ({ path, width, overflow, errors })),
      null,
      2,
    ),
  )
} finally {
  await browser.close()
  await server?.close()
}
