export type Region = { id: number; name: string }
export type FacilityDetail = {
  id: number; name: string; regionId: number; roadAddress: string;
  latitude: number; longitude: number; heightM: number | null; lengthM: number | null;
  floodHistoryCount: number; entryCameraId: number | null; exitCameraId: number | null
}
export type Camera = {
  id: number; cameraRole: 'CCTV' | 'APPROACH_LPR' | 'ROI_LPR';
  distanceM: number | null; latitude: number | null; longitude: number | null; streamUrl: string | null
}
export type Transit = { id: number; carNum: string; status: 'REMAINING' | 'IN_TRANSIT' | 'EXITED'; entryAt: string; exitAt: string | null }

export async function adminApi<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    credentials: 'include', cache: 'no-store', ...init,
    headers: { ...(init?.body && !(init.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}), ...init?.headers },
  })
  const body = await response.json().catch(() => null)
  if (response.status === 401) window.dispatchEvent(new Event('routel-manager-session-expired'))
  if (!response.ok) throw new Error(body?.message || `요청 실패 (${response.status})`)
  return body?.data as T
}

export const regionsApi = () => adminApi<Region[]>('/regions')
export const facilityDetailApi = (id: string | number) => adminApi<FacilityDetail>(`/underpasses/${id}`)
