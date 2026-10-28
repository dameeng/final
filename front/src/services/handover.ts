export type Handover = {
  id: number | null; written: boolean; shiftId: number | null; shiftName: string; shiftDate: string
  shiftStart: string; shiftEnd: string; windowStart: string; windowEnd: string
  managerId: number | null; authorName: string | null; authorPhone: string | null; memo: string | null; createdAt: string | null
  summary: {
    demo?: boolean; pmLive?: boolean
    counts?: Record<string, number>
    blockedNow?: { underpassId: number; name: string; riskLevel: string }[]
    elevatedNow?: { underpassId: number; name: string; riskLevel: string }[]
    pm?: { openEventCount?: number; actionCount?: number; newEventCount?: number; neverReceived?: number; stale?: unknown[] }
    staff?: { managerId: number; name: string; phone: string; total: number; block: number; release: number; plateReview: number; pmAction: number; displayEdit: number; transfer: number; inquiryAnswer: number }[]
    activities?: { at: string; category: string; content: string; actor: string | null }[]
  }
}
