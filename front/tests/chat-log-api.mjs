import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { createChatLogStore, createChatLogMiddleware } from '../server/chat-log-store.mjs'
import { createChatMiddleware } from '../server/chat-api.mjs'

const directory = await mkdtemp(join(tmpdir(), 'routel-chat-log-'))
let role = 'REGIONAL_ADMIN', providerFailure = false
const calls = [], now = () => Date.parse('2026-10-26T05:00:00Z')
const fakeFetch = async (url, options = {}) => {
  const path = new URL(url).pathname
  calls.push({ path, headers: options.headers })
  if (path === '/api/managers/me') return Response.json({ data: { id: 1, role } })
  if (path.includes(':generateContent')) return providerFailure
    ? new Response('{}', { status: 429 })
    : Response.json({ candidates: [{ content: { parts: [{ text: '문의는 test@example.com 또는 010-1234-5678입니다.' }] } }] })
  return Response.json({ data: [] })
}
const env = { CHAT_AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'test-key', BACKEND_URL: 'http://backend.invalid' }
const store = createChatLogStore(directory)
await store.scan(() => assert.fail('new store must be empty'))
const middleware = createChatMiddleware(env, { fetchImpl: fakeFetch, now, logStore: store })
let admin = createChatLogMiddleware(env, store, { fetchImpl: fakeFetch, now })
const server = createServer((req, res) => admin(req, res, () => middleware(req, res, () => { res.statusCode = 404; res.end() })))
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const origin = `http://127.0.0.1:${server.address().port}`
const sessionId = randomUUID()
const get = async (path, authenticated = true) => {
  const response = await fetch(origin + path, { headers: authenticated ? { Cookie: 'JSESSIONID=test-only' } : {} })
  return { status: response.status, body: await response.json() }
}
try {
  assert.equal((await get('/api/assistant/admin/logs', false)).status, 401)
  role = 'customer'
  assert.equal((await get('/api/assistant/admin/logs')).status, 403)
  role = 'REGIONAL_ADMIN'
  assert.equal((await get('/api/assistant/admin/logs')).body.data.totalItems, 0)
  for (let i = 0; i < 11; i++) {
    providerFailure = i === 10
    const response = await fetch(origin + '/api/assistant/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, messages: [{ role: 'user', content: `질문 ${i} test@example.com 010-1234-5678` }] }) })
    assert.equal(response.status, providerFailure ? 429 : 200)
    await response.json()
  }
  const first = await get('/api/assistant/admin/logs'), second = await get('/api/assistant/admin/logs?page=2')
  assert.equal(first.body.data.items.length, 10)
  assert.equal(second.body.data.items.length, 1)
  assert.equal(first.body.data.totalItems, 11)
  assert(!Object.hasOwn(first.body.data.items[0], 'answer'))
  const stats = (await get('/api/assistant/admin/stats?days=7')).body.data
  assert.equal(stats.total, 11)
  assert.equal(stats.answered, 10)
  assert.equal(stats.unanswered, 1)
  assert.equal(stats.sessions, 1)
  assert.equal(stats.successRate, 91)
  assert.equal(stats.daily.length, 7)
  assert.equal(stats.daily.reduce((sum, row) => sum + row.count, 0), 11)
  const filtered = (await get('/api/assistant/admin/logs?result=unanswered&q=' + encodeURIComponent('질문 10'))).body.data
  assert.equal(filtered.items.length, 1)
  const id = first.body.data.items[0].id
  const detail = (await get('/api/assistant/admin/logs/' + id)).body.data
  assert.equal(detail.messages.length, 11)
  assert(detail.messages.some(row => row.answer.includes('[이메일 가림]')))
  const disk = await readFile(join(directory, 'chat-turns.jsonl'), 'utf8')
  assert(!disk.includes('test@example.com'))
  assert(!disk.includes('010-1234-5678'))
  assert(!disk.includes('JSESSIONID'))
  assert(!disk.includes('test-key'))
  // Recreate storage and API instances to prove records survive process state loss.
  admin = createChatLogMiddleware(env, createChatLogStore(directory), { fetchImpl: fakeFetch, now })
  assert.equal((await get('/api/assistant/admin/logs')).body.data.totalItems, 11)
  assert.equal((await get('/api/assistant/admin/logs/' + randomUUID())).status, 404)
  assert.equal((await get('/api/assistant/admin/stats?days=1')).body.data.daily.length, 1)
  for (const call of calls) if (call.path !== '/api/managers/me') assert(!call.headers?.Cookie)
  console.log('PASS durable chat logs: success/failure, admin session authorization, 10-row pagination, search, session detail, real stats, masking, restart recovery; mocked provider only')
} finally {
  await new Promise(resolve => server.close(resolve))
  await rm(directory, { recursive: true, force: true })
}
