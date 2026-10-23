import { chromium } from '@playwright/test'
import { createServer } from 'vite'
import { mkdir, writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'

// Local fixtures only: partner branding and home paint must retain destinations.
const output = 'tests/design-preview/home-partners-polish'
const destinations = {
  '/info/its': 'https://www.its.go.kr/',
  '/info/kma': 'https://www.weather.go.kr/',
  '/info/straffic': 'https://www.straffic.co.kr/',
}
const results = [], errors = []
console.log('Preparing home and partner QA')
const server = process.env.HOME_PARTNERS_QA_ORIGIN ? null : await createServer({ configLoader: 'runner', cacheDir: `${output}/.vite-cache`, server: { host: '127.0.0.1', port: 0, strictPort: false, watch: null } })
console.log('Vite created')
await server?.listen()
const origin = process.env.HOME_PARTNERS_QA_ORIGIN || `http://127.0.0.1:${server.httpServer.address().port}`
console.log(`Vite ready: ${origin}`)
const browser = await chromium.launch({ channel: 'msedge', headless: true })
console.log('Browser ready')
await mkdir(output, { recursive: true })
try {
  const page = await browser.newPage()
  page.setDefaultTimeout(12000)
  page.setDefaultNavigationTimeout(30000)
  page.on('pageerror', error => errors.push({ path: new URL(page.url()).pathname, message: error.message }))
  await page.addInitScript(() => localStorage.setItem('routel-session-kind', 'customer'))
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname
    const data = path === '/api/customers/me' ? { id: 8, name: '김사용', loginId: 'customer', phone: '01000000000', email: 'customer@example.test' }
      : path.endsWith('unread-count') ? { count: 0, total: 0, byCategory: {} } : []
    return route.fulfill({ json: { success: true, data } })
  })
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    for (const path of ['/', ...Object.keys(destinations)]) {
      console.log(`Loading ${path} at ${width}px`)
      await page.goto(origin + path, { waitUntil: 'domcontentloaded' })
      await page.locator(path === '/' ? '.home-hero' : '.information-link-card').waitFor()
      await page.evaluate(() => document.fonts.ready)
      for (const theme of ['light', 'dark']) {
        await page.evaluate(theme => { document.documentElement.dataset.theme = theme; window.scrollTo(0, 0) }, theme)
        await page.waitForTimeout(700)
        const check = await page.evaluate(async () => {
          const visible = node => node.getClientRects().length > 0 && getComputedStyle(node).visibility !== 'hidden'
          const main = document.querySelector('main.home-premium,main.page-c-links')
          const images = [...main.querySelectorAll('img')].filter(visible)
          await Promise.all(images.map(image => image.decode().catch(() => {})))
          const brokenImages = images.filter(image => !image.complete || !image.naturalWidth).map(image => image.src)
          const clippedControls = [...main.querySelectorAll('a,button')].filter(visible).filter(node => node.scrollWidth > node.clientWidth + 2 || node.scrollHeight > node.clientHeight + 2).map(node => node.textContent.trim())
          const image = main.querySelector('.information-partner-logo')
          let logo = null
          if (image && image.naturalWidth) {
            const canvas = document.createElement('canvas')
            canvas.width = 300; canvas.height = 180
            const ctx = canvas.getContext('2d')
            ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
            const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data
            let transparent = 0, opaque = 0
            for (let i = 3; i < pixels.length; i += 4) { if (pixels[i] === 0) transparent++; if (pixels[i] > 220) opaque++ }
            const bounds = image.getBoundingClientRect(), frame = image.parentElement.getBoundingClientRect()
            logo = { source: image.getAttribute('src'), alt: image.alt, transparent, opaque, withinFrame: bounds.left >= frame.left && bounds.right <= frame.right && bounds.top >= frame.top && bounds.bottom <= frame.bottom }
          }
          const hero = main.querySelector('.home-hero'), visual = main.querySelector('.home-hero-visual')
          const photo = main.querySelector('.home-hero-visual>img')
          return {
            overflow: document.documentElement.scrollWidth > innerWidth + 1,
            clippedControls, brokenImages, logo,
            links: [...main.querySelectorAll('a')].map(link => ({ href: link.getAttribute('href'), target: link.target, rel: link.rel })),
            hero: hero ? { columns: getComputedStyle(hero).gridTemplateColumns, filter: getComputedStyle(photo).filter, seam: getComputedStyle(visual, '::before').backgroundImage, seamDirection: getComputedStyle(hero).getPropertyValue('--home-photo-seam').trim(), rect: { width: hero.clientWidth, height: hero.clientHeight } } : null,
          }
        })
        results.push({ path, width, theme, ...check })
        assert.equal(check.overflow, false, `${path} ${width} ${theme}: horizontal overflow`)
        assert.deepEqual(check.clippedControls, [], `${path} ${width} ${theme}: clipped action`)
        assert.deepEqual(check.brokenImages, [], `${path}: missing image`)
        if (path === '/') {
          for (const href of ['/info/underpasses', '/info/business', '/info/notices', '/info/company']) assert(check.links.some(link => link.href === href), `Home retains ${href}`)
          assert(check.hero.seam.includes('linear-gradient'), 'Hero blends photo into the theme surface')
          // CSSOM omits the default 180deg angle when serializing a gradient.
          assert.equal(check.hero.seamDirection, width <= 760 ? '180deg' : '90deg', 'Photo seam follows responsive reading direction')
        } else {
          assert(check.logo?.transparent > 0 && check.logo?.opaque > 100, `${path}: official logo retains transparent background and visible artwork`)
          assert(check.logo.withinFrame && check.logo.alt.length > 0, `${path}: logo fits its container and has accessible text`)
          assert(check.links.some(link => link.href === destinations[path] && link.target === '_blank' && link.rel.includes('noopener')), `${path}: official destination retained`)
        }
        if ([390, 1440].includes(width)) await page.screenshot({ path: `${output}/${path.replaceAll('/', '_')}-${width}-${theme}.png`, fullPage: true })
        console.log(`PASS ${path} ${width} ${theme}`)
      }
    }
  }
  assert.deepEqual(errors, [], 'No runtime errors')
} finally {
  await writeFile(`${output}/results.json`, JSON.stringify({ checks: results.length, results, errors }, null, 2))
  await browser.close()
  await server?.close()
}
console.log(JSON.stringify({ checks: results.length, errors: errors.length }))
