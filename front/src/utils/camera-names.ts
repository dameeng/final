// 초량지하차도 시연용 카메라 이름 (DB camera 테이블에 이름 칸이 없어서 번호로 정함. seed_all_v8.sql 9-1 참고)
export const DEMO_CAMERA_NAMES: Record<string, string> = {
  '226': 'APPROACH',
  '227': 'ROI',
  '228': '입구',
  '229': '출구',
  '230': '노면·싱크홀',
}

// 기록 표처럼 카메라 번호만 있을 때: '입구 · 228', 모르는 번호는 번호 그대로
export function cameraLabel(id: unknown) {
  if (id == null || id === '') return '—'
  const name = DEMO_CAMERA_NAMES[String(id)]
  return name ? `${name} · ${id}` : String(id)
}
