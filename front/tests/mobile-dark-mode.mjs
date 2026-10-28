import { chromium } from '@playwright/test'
import { createServer } from 'vite'
import assert from 'node:assert/strict'

const server = await createServer({ configLoader: 'runner', server: { host: '127.0.0.1', port: 0, strictPort: false } })
await server.listen()
let browser
try {
  browser = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  const base = `http://127.0.0.1:${server.httpServer.address().port}`
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/api/**', route => route.fulfill({ json: { success: true, data: [] } }))
  await page.route('https://dapi.kakao.com/**', route => route.abort())
  await page.addInitScript(() => { localStorage.setItem('theme', 'dark') })
  // 실제 화면의 CSS로 백엔드와 무관하게 선택·배지·입력 상태를 확인합니다.
  await page.goto(base + '/customer-app/screen-7')
  const styles = ['meeting-layout', 'components/risk-level-badge', 'components/admin-app-nav',
    'components/pass-signup-verification', 'components/faq-accordion', 'components/notification-bell',
    'customer-directions', 'map-weather', 'components/traffic-map-layers', 'dark-mode']
  await page.setContent(styles.map(file => `<link rel="stylesheet" href="${base}/src/styles/${file}.css">`).join('') + `
    <main class="wire-page mobile-page navigation-page" style="padding:16px">
      <h2>다크 모드 상태 확인</h2>
      <p><span class="risk-level-badge risk-level-badge--safe">안전</span>
      <span class="risk-level-badge risk-level-badge--watch">관심</span>
      <span class="risk-level-badge risk-level-badge--caution">주의</span>
      <span class="risk-level-badge risk-level-badge--alert">경계</span>
      <span class="risk-level-badge risk-level-badge--severe">심각</span></p>
      <div class="navigation-route-options"><button aria-pressed="true">추천 경로</button></div>
      <p><input aria-label="검색" placeholder="시설 검색"></p>
      <details class="faq-accordion-item" open><summary>자주 묻는 질문</summary><div class="faq-inline-answer">답변 내용</div></details>
      <nav class="admin-app-bottom-nav"><a aria-current="page">현황</a></nav>
    </main>
    <section class="pass-signup-dialog"><div class="pass-carriers"><button>통신사</button></div><input aria-label="인증번호"><div class="pass-demo-label">안내</div></section>
    <section class="customer-notification-popup" style="position:static"><div class="notification-popup-body"><ul><li class="unread"><a href="#"><strong>안 읽은 알림</strong><span class="notification-popup-copy">알림 내용</span></a></li></ul></div></section>
    <section class="wire-page mobile-app-map" style="padding:16px">
      <form class="app-map-search"><input placeholder="시설 검색"><button>검색</button></form>
      <div class="mtop"><div class="pill"><button class="legend-filter-button">안전</button></div></div>
      <div class="traffic-layer-switches"><button>CCTV</button><button>VMS</button></div>
      <div class="map-weather-widget" style="position:static"><button class="map-weather-marker"><strong>22°</strong><small>맑음</small></button></div>
      <div class="kakao-map-controls"><button>+</button><button>−</button></div>
    </section>`)
  await page.evaluate(() => { document.documentElement.dataset.theme = 'dark' })
  await page.waitForFunction(() => getComputedStyle(document.querySelector('.risk-level-badge--safe')).backgroundColor === 'rgb(32, 59, 51)')
  const background = selector => page.locator(selector).evaluate(el => getComputedStyle(el).backgroundColor)
  assert.equal(await background('.navigation-route-options button'), 'rgb(48, 70, 92)')
  assert.equal(await background('.pass-signup-dialog input'), 'rgb(28, 35, 41)')
  assert.equal(await background('.faq-inline-answer'), 'rgb(43, 51, 59)')
  assert.equal(await background('.admin-app-bottom-nav a'), 'rgb(41, 60, 76)')
  assert.equal(await background('.unread a'), 'rgb(41, 60, 76)')
  for (const selector of ['.app-map-search', '.mtop .pill', '.traffic-layer-switches button:first-child', '.kakao-map-controls button:first-child']) {
    assert.equal(await background(selector), 'rgb(37, 47, 56)', `Consistent map surface: ${selector}`)
  }
  assert.equal(await background('.map-weather-marker'), 'rgb(34, 39, 44)')
  assert.equal(await page.locator('.map-weather-marker small').evaluate(el => getComputedStyle(el).color), 'rgb(186, 194, 201)')
  const contrast = await page.locator('.risk-level-badge').evaluateAll(elements => {
    function luminance(color) {
      const rgb = color.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => {
        const s = v / 255
        return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
      })
      return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722
    }
    return elements.map(el => {
      const style = getComputedStyle(el), fg = luminance(style.color), bg = luminance(style.backgroundColor)
      return (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05)
    })
  })
  assert(contrast.every(ratio => ratio >= 4.5), `Badge contrast: ${contrast}`)
  await page.evaluate(()=>{
    const root=document.createElement('div');root.id='app'
    root.innerHTML='<section class="admin-app-map"><div class="traffic-layer-switches"><button aria-pressed="false">CCTV</button><button aria-pressed="true">VMS</button></div><div class="kakao-map-controls"><button>전체 보기</button><button>+</button><button disabled>−</button></div></section>'
    document.body.append(root)
  })
  const adminButtons=await page.locator('#app .admin-app-map button').evaluateAll(items=>items.map(el=>{
    const style=getComputedStyle(el);return {background:style.backgroundColor,color:style.color,opacity:style.opacity}
  }))
  assert(adminButtons.every(button=>button.background!=='rgb(255, 255, 255)'&&button.background!=='rgba(0, 0, 0, 0)'), 'Administrator map buttons use opaque dark surfaces')
  assert.notEqual(adminButtons[0].background,adminButtons[1].background,'Selected traffic layer is distinct')
  assert(Number(adminButtons.at(-1).opacity)<1,'Disabled map control is distinct')
  await page.screenshot({ path: 'test-results/mobile-dark-components.png', fullPage: true })
  await page.evaluate(() => { document.documentElement.dataset.theme = 'light' })
  assert.equal(await background('.risk-level-badge--safe'), 'rgb(225, 243, 234)')
  assert.equal(await background('.pass-signup-dialog input'), 'rgb(255, 255, 255)')
  for (const path of ['/customer-app/screen-1', '/customer-app/screen-7', '/customer-app/faq', '/customer-app/notices', '/admin-app/screen-1']) {
    for (const [width,height] of [[320,568],[360,640],[390,844],[430,932],[844,390]]) {
    await page.setViewportSize({width,height})
    await page.goto(base + path)
    await page.locator('#app').waitFor()
    for (const theme of ['light','dark']) {
      await page.evaluate(value => { document.documentElement.dataset.theme = value },theme)
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `Horizontal overflow: ${path}, ${width}x${height}, ${theme}`)
    }
    if (width===390)
    await page.screenshot({ path: `test-results/dark-${path.split('/').filter(Boolean).join('-')}.png`, fullPage: true })
    }
  }
  assert.deepEqual(errors, [])
  console.log('PASS mobile dark components, badge contrast >= 4.5, light theme isolation, five mobile routes and no horizontal overflow')
} finally {
  await browser?.close()
  await server.close()
}
