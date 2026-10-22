import { chromium } from '@playwright/test'
import { createServer } from 'vite'
import assert from 'node:assert/strict'
const server = await createServer({ configLoader:'runner', server:{ host:'127.0.0.1', port:0, strictPort:false } })
await server.listen()
const browser = await chromium.launch({ channel:'msedge', headless:true })
try {
  const page = await browser.newPage({ reducedMotion:'reduce' })
  await page.route('**/error-fixture', route => route.fulfill({ contentType:'text/html', body:'<main id="app"><p id="error" role="alert"></p><div style="height:2400px"></div><button id="bottom">입력</button></main>' }))
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/error-fixture`)
  await page.evaluate(async () => {
    const { installErrorVisibility } = await import('/src/runtime/errorVisibility.ts')
    installErrorVisibility(document.getElementById('app'))
  })
  await page.locator('#bottom').scrollIntoViewIfNeeded()
  await page.evaluate(() => document.getElementById('error').textContent='요청을 처리하지 못했습니다.')
  await page.waitForFunction(() => window.scrollY < 100)
  await page.locator('#bottom').scrollIntoViewIfNeeded()
  await page.evaluate(() => document.getElementById('bottom').textContent='다시 입력')
  await page.waitForTimeout(100)
  assert(await page.evaluate(() => window.scrollY > 1000), '기존 오류로 반복 이동하지 않음')
  await page.evaluate(() => {
    const dialog = document.createElement('dialog')
    dialog.style.cssText='height:250px;overflow:auto'
    dialog.innerHTML='<p class="service-error" id="dialog-error"></p><div style="height:1600px"></div><button>저장</button>'
    document.getElementById('app').append(dialog); dialog.showModal(); dialog.scrollTop=1400
  })
  await page.evaluate(() => document.getElementById('dialog-error').textContent='저장하지 못했습니다.')
  await page.waitForFunction(() => document.querySelector('dialog').scrollTop < 100)
  await page.evaluate(() => { document.querySelector('dialog').scrollTop=1400; document.getElementById('error').textContent='배경 오류 갱신' })
  await page.waitForTimeout(100)
  assert(await page.evaluate(() => document.querySelector('dialog').scrollTop > 1000), '팝업 뒤 오류가 화면을 이동시키지 않음')
  console.log('통과: 페이지·팝업 오류 자동 이동, 기존 오류 반복 이동 방지, 배경 오류 제외')
} finally { await browser.close(); await server.close() }
