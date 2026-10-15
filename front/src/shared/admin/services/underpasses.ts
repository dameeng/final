import { regionsApi } from './admin-api'

export type Status = '정상' | '주의' | '통제'

export interface Underpass {
  id: string
  name: string
  region: string
  regionId?: number | null
  controlState?: 'OPEN' | 'BLOCKED' | 'UNKNOWN'
  observedRiskLevel?: 'SAFE' | 'WARNING' | 'DANGER' | 'UNKNOWN'
  waterLevelUnit?: string
  observedUpdatedAt?: string | null
  status: Status
  riskLevel?: 'SAFE' | 'WARNING' | 'DANGER' | 'UNKNOWN'
  rainfall: number | null
  waterLevel: number | null
  riskScore?: number
  latitude?: number
  longitude?: number
  updatedAt: string
}

export interface ControlLog {
  id: number
  name: string
  action: string
  operator: string
  time: string
  reason: string
}

const apiRoot = `${(import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')}/api`

type UnderpassRecord = Record<string, unknown>

function parseItems(body: unknown): unknown[] {
  if (Array.isArray(body)) return body
  if (body && typeof body === 'object') {
    const value = body as UnderpassRecord
    const content = value.data ?? value.items ?? value.content
    if (Array.isArray(content)) return content
    if (content && typeof content === 'object') {
      const nested = content as UnderpassRecord
      if (Array.isArray(nested.items)) return nested.items
      if (Array.isArray(nested.content)) return nested.content
    }
  }
  throw new Error('시설 목록 응답 형식을 확인해 주세요.')
}

// 백엔드 currentRiskLevel은 상수명(SAFE/WARNING/DANGER)으로 내려온다. 한글 값도 혹시 몰라 같이 받아준다.
const RISK_LEVEL_MAP: Record<string, 'SAFE' | 'WARNING' | 'DANGER'> = {
  안전: 'SAFE', 경고: 'WARNING', 위험: 'DANGER',
  SAFE: 'SAFE', WARNING: 'WARNING', DANGER: 'DANGER',
}

function normalize(row: unknown, regionNames: Map<number, string>): Underpass | null {
  if (!row || typeof row !== 'object') return null
  const value = row as UnderpassRecord
  const id = String(value.underpassId ?? value.id ?? '')
  const name = String(value.underpassName ?? value.name ?? '')
  if (!id || !name) return null
  const raw = String(value.currentStatus ?? value.status ?? value.controlStatus ?? '').toUpperCase()
  const risk = RISK_LEVEL_MAP[String(value.currentRiskLevel ?? '')] ?? 'UNKNOWN'
  const status: Status = raw === 'BLOCKED' || raw === 'CLOSED' || raw === '통제'
    ? '통제' : raw === 'CAUTION' || raw === 'WARNING' || raw === '주의' || risk === 'WARNING' || risk === 'DANGER' ? '주의' : '정상'
  const number = (input: unknown) => Number.isFinite(Number(input)) ? Number(input) : 0
  return {
    id,
    name,
    region: String(value.region ?? value.regionName ?? regionNames.get(Number(value.regionId)) ?? (value.regionId == null ? '미배정' : `지역 ${value.regionId}`)),
    observedUpdatedAt: value.updatedAt == null ? null : String(value.updatedAt),
    regionId: value.regionId == null ? null : Number(value.regionId),
    controlState: ['BLOCKED', 'CLOSED', '통제'].includes(raw) ? 'BLOCKED'
      : ['OPEN', 'NORMAL', 'RELEASED', '정상', '해제'].includes(raw) ? 'OPEN' : 'UNKNOWN',
    observedRiskLevel: risk,
    waterLevelUnit: typeof value.waterLevelUnit === 'string' ? value.waterLevelUnit : undefined,
    status,
    riskLevel: raw === 'BLOCKED' ? 'DANGER' : risk,
    rainfall: value.rainfall == null || value.rainfall === '' || !Number.isFinite(Number(value.rainfall)) ? null : Number(value.rainfall),
    waterLevel: value.waterLevel == null || value.waterLevel === '' || !Number.isFinite(Number(value.waterLevel)) ? null : Number(value.waterLevel),
    riskScore: value.riskScore == null || !Number.isFinite(Number(value.riskScore)) ? undefined : Number(value.riskScore),
    latitude: value.latitude == null ? undefined : number(value.latitude),
    longitude: value.longitude == null ? undefined : number(value.longitude),
    updatedAt: String(value.updatedAt ?? value.createdAt ?? '-'),
  }
}

// 실패하면 예외를 던진다. 호출하는 쪽(main.ts refresh)이 state.error에 담아 화면 상단 배너로 보여준다.
export async function fetchUnderpasses(regionId?: number | null): Promise<Underpass[]> {
  const regions = await regionsApi().catch(() => [])
  const names = new Map(regions.map(item => [item.id, item.name]))
  const rows: unknown[] = []
  for (let page = 1; page <= 100; page++) {
    const response = await fetch(`${apiRoot}/underpasses?page=${page}&size=100${regionId != null ? `&regionId=${encodeURIComponent(regionId)}` : ''}`, {
      credentials: 'include', cache: 'no-store', signal: AbortSignal.timeout(5000),
    })
    if (response.status === 401) window.dispatchEvent(new Event('routel-manager-session-expired'))
    if (!response.ok) throw new Error(`시설 목록 조회 실패 (${response.status})`)
    const body = await response.json()
    rows.push(...parseItems(body))
    const totalPages = Number(body?.data?.totalPages ?? 1)
    if (page >= totalPages) break
  }
  return rows.map(row => normalize(row, names)).filter((row): row is Underpass => row !== null)
}

export async function sendControl(id: string, status: Status): Promise<void> {
  const action = status === '통제' ? 'block' : 'release'
  const response = await fetch(`${apiRoot}/underpasses/${encodeURIComponent(id)}/${action}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  })
  if (response.status === 401) window.dispatchEvent(new Event('routel-manager-session-expired'))
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(body?.message || `통제 변경에 실패했습니다. (${response.status})`)
  }
}