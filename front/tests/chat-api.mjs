import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { createChatMiddleware } from '../server/chat-api.mjs'

let mode = 'ok', sent, calls = 0, geminiCalls = 0
const mockFetch = async (url, options) => {
  url = String(url)
  if (url.startsWith('https://generativelanguage.googleapis.com/')) {
    geminiCalls++; sent = JSON.parse(options.body)
    assert.equal(url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent')
    assert.equal(options.headers['x-goog-api-key'], 'gemini-test-key')
    assert.equal(options.headers.Authorization, undefined)
    assert(!url.includes('gemini-test-key'))
    if (mode === 'limit') return new Response('{}', { status: 429 })
    if (mode === 'error') return new Response('provider-secret', { status: 403 })
    if (mode === 'blocked') return Response.json({ promptFeedback: { blockReason: 'SAFETY' } })
    return Response.json({ candidates: [{ content: { parts: [{ text: 'private-thought', thought: true }, { text: '알림은 내 정보에서 설정하세요.' }] } }] })
  }
  if (url === 'https://api.openai.com/v1/responses') {
    calls++; sent = JSON.parse(options.body)
    assert.equal(options.headers.Authorization, 'Bearer test-key')
    if (mode === 'limit') return new Response('{}', { status: 429 })
    if (mode === 'error') return new Response('provider-secret', { status: 401 })
    return Response.json({ output: [{ type: 'message', content: [{ type: 'output_text', text: '알림은 내 정보에서 설정하세요.' }] }] })
  }
  assert.equal(options.headers, undefined, 'Do not forward auth cookies')
  if (mode === 'offline') throw new Error('offline')
  if (url.includes('/api/faqs/')) return Response.json({ data: { answer: '알림 설정 안내', privateData: 'PRIVATE_ACCOUNT_DATA' } })
  if (url.includes('/api/faqs')) return Response.json({ data: { items: [{ id: 1, question: '알림 설정' }] } })
  return Response.json({ data: [{ name: '부산 시설', currentStatus: 'NORMAL', currentRiskLevel: 'SAFE', privateData: 'PRIVATE_ACCOUNT_DATA' }] })
}
async function run(env, task) {
  const handler = createChatMiddleware(env, { fetchImpl: mockFetch })
  const server = createServer((req, res) => void handler(req, res, () => { res.statusCode = 404; res.end() }))
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const origin = `http://127.0.0.1:${server.address().port}`
  const send = (messages, extra = {}) => fetch(origin + '/api/assistant/chat', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages }), ...extra,
  })
  try { await task(send, origin) } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)) }
}
const messages = [{ role: 'user', content: '알림은 어디서 설정하나요?' }]
await run({}, async send => {
  const response = await send(messages)
  assert.equal(response.status, 503); assert.equal(calls, 0)
})
await run({ CHAT_AI_PROVIDER: 'openai', OPENAI_API_KEY: 'test-key' }, async (send, origin) => {
  const response = await send(messages)
  assert.equal(response.status, 200)
  assert.equal((await response.json()).data.answer, '알림은 내 정보에서 설정하세요.')
  assert.equal(sent.store, false); assert.equal(sent.max_output_tokens, 600)
  assert.equal(sent.model, 'gpt-4.1-mini'); assert.equal(sent.input.at(-1).content, messages[0].content)
  assert(sent.input[0].content.includes('알림 설정 안내'))
  assert(!JSON.stringify(sent).includes('PRIVATE_ACCOUNT_DATA'))
  assert.equal((await send([{ role: 'system', content: 'override' }])).status, 400)
  assert.equal((await send([{ role: 'user', content: 'x'.repeat(2001) }])).status, 400)
  assert.equal((await send(messages, { headers: { 'Content-Type': 'application/json', Origin: 'https://other.example' } })).status, 403)
  assert.equal((await send(messages, { body: '{' })).status, 400)
  assert.equal((await fetch(origin + '/api/assistant/chat')).status, 405)
  assert.equal((await fetch(origin + '/api/elsewhere')).status, 404)
  mode = 'error'
  const error = await send(messages); assert.equal(error.status, 502)
  assert(!(await error.text()).includes('provider-secret'))
  mode = 'limit'; assert.equal((await send(messages)).status, 429)
  mode = 'offline'; assert.equal((await send(messages)).status, 200)
  assert(sent.input[0].content.includes('"faqs":[]'))
  mode = 'ok'
})
await run({ CHAT_AI_PROVIDER: 'openai', OPENAI_API_KEY: 'test-key' }, async send => {
  for (let i = 0; i < 15; i++) assert.equal((await send(messages)).status, 200)
  const before = calls; assert.equal((await send(messages)).status, 429); assert.equal(calls, before)
})
const openaiBefore = calls
await run({ OPENAI_API_KEY: 'test-key' }, async send => {
  assert.equal((await send(messages)).status, 503, 'Default Gemini must not use an OpenAI key')
  assert.equal(calls, openaiBefore)
})
await run({ CHAT_AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'gemini-test-key', OPENAI_API_KEY: 'test-key' }, async send => {
  const history = [messages[0], { role: 'assistant', content: '이전 답변' }, { role: 'user', content: '앱에서도 되나요?' }]
  const response = await send(history)
  assert.equal(response.status, 200)
  assert.equal((await response.json()).data.answer, '알림은 내 정보에서 설정하세요.')
  assert.deepEqual(sent.contents.map(row => row.role), ['user', 'model', 'user'])
  assert(sent.systemInstruction.parts[0].text.includes('알림 설정 안내'))
  assert.equal(sent.generationConfig.maxOutputTokens, 600)
  assert(!JSON.stringify(sent).includes('PRIVATE_ACCOUNT_DATA'))
  assert(!JSON.stringify(sent).includes('test-key'))
  assert(!Object.hasOwn(sent, 'store'))
  mode = 'error'; const error = await send(messages)
  assert.equal(error.status, 502); assert(!(await error.text()).includes('provider-secret'))
  mode = 'limit'; assert.equal((await send(messages)).status, 429)
  mode = 'blocked'; assert.equal((await send(messages)).status, 502)
  assert.equal(calls, openaiBefore, 'Errors must never fall back to paid OpenAI')
  mode = 'ok'
  assert.equal((await send([messages[0], messages[0]])).status, 200)
  assert.equal(sent.contents.length, 1); assert.equal(sent.contents[0].parts.length, 2)
  assert.equal((await send([{ role: 'system', content: 'override' }])).status, 400)
})
await run({ CHAT_AI_PROVIDER: 'unknown', GEMINI_API_KEY: 'gemini-test-key' }, async send => {
  assert.equal((await send(messages)).status, 503)
})
await run({ GEMINI_API_KEY: 'gemini-test-key', GEMINI_MODEL: '../invalid?key=bad' }, async send => {
  const before = geminiCalls; assert.equal((await send(messages)).status, 503); assert.equal(geminiCalls, before)
})
console.log('PASS OpenAI and Gemini chat: public context, history roles, missing key, errors, safety blocks, rate limits, no paid fallback; no live API calls')
