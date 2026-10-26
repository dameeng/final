import { mkdir, appendFile } from 'node:fs/promises'
import { createReadStream } from 'node:fs'
import { createInterface } from 'node:readline'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

export function redactChatText(value) {
  return String(value || '').slice(0, 12000)
    .replace(/(?:AIza[\w-]{25,}|sk-[\w-]{16,})/g, '[API 키 가림]')
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '[이메일 가림]')
    .replace(/\b01[016789][- .]?\d{3,4}[- .]?\d{4}\b/g, '[전화번호 가림]')
}
export function createChatLogStore(directory) {
  const file = join(directory, 'chat-turns.jsonl')
  let pending = Promise.resolve()
  return {
    async append(row) {
      const record = { ...row, id: randomUUID(), question: redactChatText(row.question), answer: redactChatText(row.answer) }
      const write = pending.catch(() => {}).then(async () => {
        await mkdir(directory, { recursive: true, mode: 0o700 })
        await appendFile(file, JSON.stringify(record) + '\n', { encoding: 'utf8', mode: 0o600 })
      })
      pending = write
      await write
      return record
    },
    async scan(visit) {
      await pending.catch(() => {})
      const stream = createReadStream(file, { encoding: 'utf8' })
      const lines = createInterface({ input: stream, crlfDelay: Infinity })
      try {
        for await (const line of lines) {
          let row
          try { row = JSON.parse(line) } catch { continue }
          if (row?.id && row.createdAt && typeof row.question === 'string') visit(row)
        }
      } catch (error) { if (error.code !== 'ENOENT') throw error }
      finally { lines.close(); stream.destroy() }
    },
  }
}

const dateKey = time => new Date(time).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })
export function createChatLogMiddleware(env, store, { fetchImpl = fetch, now = Date.now } = {}) {
  return async (req, res, next) => {
    const url = new URL(req.url || '/', 'http://localhost')
    if (!url.pathname.startsWith('/api/assistant/admin/')) return next()
    const respond = (status, data, message) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
      res.end(JSON.stringify({ success: status === 200, data, message }))
    }
    try {
      if (req.method !== 'GET') return respond(405, null, '조회만 가능한 API입니다.')
      // Authenticate against the existing Spring session, never a role or name sent by the browser.
      if (!req.headers.cookie) return respond(401, null, '관리자 로그인이 필요합니다.')
      const auth = await fetchImpl(new URL('/api/managers/me', env.BACKEND_URL || 'http://localhost:5555'), {
        headers: { Cookie: req.headers.cookie }, redirect: 'error', signal: AbortSignal.timeout(3000),
      })
      if (!auth.ok) return respond(auth.status === 401 ? 401 : 403, null, '관리자 권한이 필요합니다.')
      const user = (await auth.json()).data
      if (!user?.id || user.role !== 'REGIONAL_ADMIN') return respond(403, null, '관리자 권한이 필요합니다.')
      if (url.pathname === '/api/assistant/admin/stats') {
        const days = [1, 7, 30].includes(Number(url.searchParams.get('days'))) ? Number(url.searchParams.get('days')) : 7
        const today = dateKey(now()), dates = []
        for (let i = days - 1; i >= 0; i--) dates.push(dateKey(now() - i * 86400000))
        const daily = new Map(dates.map(date => [date, 0])), questions = new Map(), sessions = new Set()
        let total = 0, answered = 0
        await store.scan(row => {
          const date = dateKey(row.createdAt)
          if (date < dates[0] || date > today) return
          total++; if (row.result === 'answered') answered++
          sessions.add(row.sessionId)
          daily.set(date, (daily.get(date) || 0) + 1)
          questions.set(row.question, (questions.get(row.question) || 0) + 1)
        })
        return respond(200, { total, answered, unanswered: total - answered, successRate: total ? Math.round(answered / total * 100) : 0,
          sessions: sessions.size, daily: [...daily].map(([date, count]) => ({ date, count })),
          topQuestions: [...questions].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([question, count]) => ({ question, count })) })
      }
      if (url.pathname === '/api/assistant/admin/logs') {
        const page = Math.max(1, Math.min(1000000, Math.floor(Number(url.searchParams.get('page'))) || 1)), size = 10
        const query = (url.searchParams.get('q') || '').trim().slice(0, 200).toLowerCase(), result = url.searchParams.get('result')
        const rows = []
        let total = 0
        await store.scan(row => {
          if (result && row.result !== result || query && !`${row.question} ${row.answer}`.toLowerCase().includes(query)) return
          total++
          rows.push(row)
          if (rows.length > page * size) rows.shift()
        })
        const totalPages = Math.max(1, Math.ceil(total / size))
        const current = Math.min(page, totalPages)
        const items = rows.reverse().slice((current - 1) * size, current * size)
          .map(({ answer, ...row }) => row)
        return respond(200, { items, page: current, size, totalItems: total, totalPages })
      }
      const match = url.pathname.match(/^\/api\/assistant\/admin\/logs\/([0-9a-f-]{36})$/)
      if (match) {
        let item
        await store.scan(row => { if (row.id === match[1]) item = row })
        if (!item) return respond(404, null, '대화 기록을 찾을 수 없습니다.')
        const messages = []
        await store.scan(row => { if (row.sessionId === item.sessionId) { messages.push(row); if (messages.length > 100) messages.shift() } })
        return respond(200, { item, messages })
      }
      return respond(404, null, '페이지를 찾을 수 없습니다.')
    } catch { respond(503, null, '대화 기록을 불러오지 못했습니다. 서버 연결을 확인해주세요.') }
  }
}
