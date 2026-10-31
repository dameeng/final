// 예지보전(pm) API 의 영문 값 -> 화면에 보일 한글. 백엔드 enum 이름 그대로 키로 쓴다
export const PM_TYPES: Record<string, string> = {
  ROAD: '노면',
  CCTV: 'CCTV',
  DISPLAY: '전광판',
  PUMP: '배수펌프',
  WATER_LEVEL: '수위계',
}
export const PM_LEVELS: Record<string, string> = { SAFE: '안전', CAUTION: '주의', DANGER: '위험' }
export const PM_EVENT_STATUS: Record<string, string> = {
  CHECK_NEEDED: '확인 필요',
  IN_PROGRESS: '점검 중',
  RESOLVED: '조치 완료',
  ETC: '기타 종료',
}
export const PM_TRIGGERS: Record<string, string> = {
  DANGER_ENTRY: '위험진입',
  SURGE: '급상승',
  NO_DATA: '미수신',
  SINKHOLE: '싱크홀 의심 탐지',
  MANUAL: '수동등록',
}
// GET /api/pm/engine-status 의 status
export const PM_ENGINE: Record<string, [string, 'ok' | 'warn' | 'bad' | 'idle']> = {
  WAITING: ['수신 대기', 'idle'],
  NORMAL: ['정상', 'ok'],
  DELAYED: ['지연', 'warn'],
  DOWN: ['중단', 'bad'],
}
// 설비 종류별 센서 컬럼 (GET /api/pm/equipments/{id}/sensor-trend 의 column)
export const PM_SENSOR_COLUMNS: Record<string, [string, string][]> = {
  CCTV: [
    ['video_receive_rate', '영상 수신률'],
    ['response_time_ms', '응답 시간'],
    ['packet_loss_rate', '패킷 손실률'],
    ['image_blur_score', '화면 흐림'],
  ],
  PUMP: [
    ['vibration', '진동'],
    ['pressure', '압력'],
    ['temperature', '온도'],
    ['current', '전류'],
    ['flow', '유량'],
    ['rpm', '회전수'],
  ],
  DISPLAY: [
    ['temperature_c', '본체 온도'],
    ['ambient_c', '외기 온도'],
    ['ripple_v', '전원 리플'],
    ['response_time_ms', '응답 시간'],
    ['error_count', '오류 횟수'],
    ['bad_pixel_pct', '불량 화소'],
  ],
  WATER_LEVEL: [['level_m', '수위']],
}
// 상세 응답 detail.extra.suspectedCause (전광판·CCTV·펌프)
export const PM_CAUSES: Record<string, string> = {
  thermal: '열',
  power: '전원',
  comm: '통신',
  display: '화면',
  video: '영상',
  vibration: '진동',
  pressure: '압력',
  temperature: '온도',
  current: '전류',
  flow: '유량',
  rpm: '회전수',
}
// 특징값 key -> 그 특징을 만든 센서 컬럼 (상세 화면이 원인 센서 그래프를 이 컬럼으로 먼저 연다)
export const PM_FEATURE_COLUMN: Record<string, string> = {
  temp_gap: 'temperature_c',
  ripple_v: 'ripple_v',
  response_time_ms: 'response_time_ms',
  error_count: 'error_count',
  bad_pixel_pct: 'bad_pixel_pct',
  receive_mean: 'video_receive_rate',
  response_mean: 'response_time_ms',
  response_trend: 'response_time_ms',
  loss_mean: 'packet_loss_rate',
  blur_max: 'image_blur_score',
  vib_level: 'vibration',
  vib_vol: 'vibration',
  press_level: 'pressure',
  temp_trend: 'temperature',
}
// 센서 컬럼 단위 (그래프 눈금·값 표시용). 펌프 센서 단위는 아래 PUMP_DISPLAY 로 환산한 값의 단위
export const PM_SENSOR_UNITS: Record<string, string> = {
  video_receive_rate: '%',
  response_time_ms: 'ms',
  packet_loss_rate: '%',
  image_blur_score: '점',
  temperature_c: '℃',
  ambient_c: '℃',
  ripple_v: 'V',
  error_count: '건',
  bad_pixel_pct: '%',
  level_m: 'm',
  vibration: 'mm/s',
  pressure: 'bar',
  temperature: '℃',
  current: 'A',
  flow: 'm³/min',
  rpm: 'rpm',
}
// 배수펌프 센서는 원본(공개 데이터 sensor_XX)에 이름·단위가 없어서, 화면에서만 일반적인 배수펌프 범위로 환산한다.
// 표시값 = 실제 평소 + (원본 - 원본 평균) / 원본 흔들림 x 실제 흔들림. 평소보다 몇 배 벗어났는지는 그대로라
// 위험 점수·'평소 범위 벗어남' 판정과 어긋나지 않는다. 원본 평균·흔들림은 pm_sensor_pump 전체 기준 (2026-10-29)
const PUMP_DISPLAY: Record<string, { mu: number; sd: number; real: number; realSd: number; digits: number }> = {
  vibration: { mu: 979.7705, sd: 7.624, real: 2.5, realSd: 0.25, digits: 2 },
  pressure: { mu: 1012.9383, sd: 14.166, real: 2.5, realSd: 0.1, digits: 2 },
  temperature: { mu: 2.5048, sd: 0.0159, real: 45, realSd: 1, digits: 1 },
  current: { mu: 1.1036, sd: 0.3237, real: 30, realSd: 2, digits: 1 },
  flow: { mu: 36.1994, sd: 1.7999, real: 10, realSd: 0.5, digits: 1 },
  rpm: { mu: 37.9986, sd: 2.9988, real: 1750, realSd: 30, digits: 0 },
}
export const PM_SENSOR_CONVERTED_NOTE = '배수펌프 센서는 원본 데이터에 단위가 없어 일반적인 배수펌프 범위로 환산해 보여 줍니다.'

// 화면에 그릴 센서 값 (그래프용, 반올림 안 함). 펌프 센서가 아니면 그대로. 환산 결과가 0 아래면 0
export function pmSensorValue(column: string, value: number) {
  const c = PUMP_DISPLAY[column]
  if (!c || !Number.isFinite(value)) return value
  return Math.max(0, c.real + ((value - c.mu) / c.sd) * c.realSd)
}
// 화면에 글자로 보일 센서 값 (센서별 자릿수로 반올림)
export function pmSensorDisplay(column: string, value: number | null | undefined) {
  if (value == null) return null
  const v = pmSensorValue(column, Number(value)), c = PUMP_DISPLAY[column]
  return c && Number.isFinite(v) ? +v.toFixed(c.digits) : v
}
// 점검 상태가 끝난 것인지 (끝난 이벤트는 다시 열 수 없다)
export const PM_CLOSED_STATUS = ['RESOLVED', 'ETC']

export function pmLabel(table: Record<string, string>, value: unknown, empty = '—') {
  if (value == null || value === '') return empty
  return table[String(value)] ?? String(value)
}

// SSE: 예지보전 화면이 다시 조회해야 하는 이벤트인지. resources 는 data-changed 의 resource 값 (pm-equipment 등)
export function isPmChange(name: string, data: Record<string, any>, resources: string[]) {
  return name === 'pm-update' || (name === 'data-changed' && resources.includes(String(data?.resource)))
}
