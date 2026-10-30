const fieldWidths: Record<string, number> = {
  id: 76, loginId: 144, role: 136, status: 136, pushStatus: 136,
  reviewStatus: 136, recognitionStatus: 136, category: 120, type: 120,
  kind: 120, important: 88, viewCount: 88, confidence: 104,
  phone: 160, emergency: 160, shiftName: 128, cameraId: 112,
  imagePath: 196, reviewDeadline: 180, detectedNum: 144, correctedNum: 144,
  displayCarNum: 144, carNum: 144, customerName: 120, authorName: 120,
  managerName: 120, startTime: 144, endTime: 144, agency: 120,
  documentType: 160, eventType: 160, alertType: 144,
}
const actionWidths: Record<string, number> = {
  managers: 330, notices: 240, inquiries: 280, cameras: 340,
  customers: 144, reviews: 180, regions: 180,
  presets: 180, reasons: 180, faqs: 240, transfers: 180, transits: 200,
}
export function resourceTableLayout(resource: string, columns: [string, string][], actions: boolean) {
  const cameraWidths: Record<string, number> = { id: 112, cameraRole: 160, distanceM: 120 }
  // OCR 인식 기록: 내용 길이에 맞춰 줄여 1440px 화면에서 가로 스크롤 없이 보이게 (카메라 'APPROACH · 226' 한 줄)
  const ocrWidths: Record<string, number> = {
    underpassName: 128, cameraId: 140, detectedNum: 112, imagePath: 196, correctedNum: 112, confidence: 80,
    recognitionStatus: 104, reviewStatus: 100, reviewDeadline: 140, detectedAt: 140,
  }
  const own = resource === 'cameras' ? cameraWidths : resource === 'ocr' ? ocrWidths : {}
  const widths = columns.map(([key]) => own[key] ?? fieldWidths[key] ?? (/At$/.test(key) ? 172 : undefined))
  if (actions) widths.push(resource === 'ocr' ? 116 : actionWidths[resource] || 180)
  const minWidth = widths.reduce<number>((sum, width) => sum + (width ?? 240), 0)
  return { widths, minWidth }
}
