import { reactive } from 'vue'

export const customerSession = reactive<{ id: number | null; name: string; ready: boolean }>({
  id: null, name: '', ready: false,
})
let sessionVersion = 0

export function setCustomerSession(id: number, name: string) {
  sessionVersion++
  customerSession.id = id
  customerSession.name = name
  customerSession.ready = true
}

export async function restoreCustomerSession() {
  const version = sessionVersion
  try {
    const response = await fetch('/api/customers/me', { credentials: 'include', cache: 'no-store' })
    if (!response.ok) throw new Error('로그인 필요')
    const body = await response.json()
    if (sessionVersion === version) {
      customerSession.id = body.data?.id ?? null
      customerSession.name = body.data?.name ?? ''
    }
  } catch {
    if (sessionVersion === version) {
      customerSession.id = null
      customerSession.name = ''
    }
  } finally { customerSession.ready = true }
}

export async function logoutCustomer() {
  const response = await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
  if (!response.ok) throw new Error('로그아웃에 실패했습니다.')
  sessionVersion++
  customerSession.id = null
  customerSession.name = ''
}
