import { fetchFacilities } from "./api";
import type { Alert, Facility } from "./types";
export interface LiveSnapshot { facilities: Facility[]; alerts: Alert[]; }
// 공용 현황(로그인 없이 조회). 인증이 필요한 개인 알림(use-personal-alerts.ts)과 분리합니다.
export async function fetchLiveSnapshot(): Promise<LiveSnapshot> {
  const facilities = await fetchFacilities();
  // 공용 위험 알림: api 없음. 백엔드 알림은 고객별 발송 기록(/api/customers/me/alerts)뿐이고
  // 로그인 없이 받는 공용 알림 조회 엔드포인트가 없어서 항상 빈 배열입니다.
  const snapshot = { facilities, alerts: [] as Alert[] };
  const validFacility = snapshot.facilities.every((f) => f && typeof f.id === "string" &&
    typeof f.name === "string" && typeof f.updatedAt === "string" &&
    typeof f.region === "string" && typeof f.address === "string" &&
    Number.isFinite(f.latitude) && Number.isFinite(f.longitude) &&
    ["OPEN", "CAUTION", "BLOCKED", "UNKNOWN"].includes(f.status));
  const validAlert = snapshot.alerts.every((a) => a && typeof a.id === "string" &&
    typeof a.title === "string" && typeof a.content === "string" &&
    Number.isFinite(Date.parse(a.createdAt)) &&
    (a.underpassId === undefined || typeof a.underpassId === "string"));
  if (!validFacility || !validAlert) throw new Error("현황 데이터 항목을 확인해 주세요.");
  return snapshot;
}

// 동일 알림은 반복 수신해도 한 번만 표시합니다. 첫 접속에도 최근 5분 알림은 표시합니다.
export function newAlerts(rows: Alert[], seen: Set<string>, now: number): Alert[] {
  const fresh: Alert[] = [];
  for (const row of [...rows].sort((a,b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    const age = now - Date.parse(row.createdAt);
    if (age >= -60000 && age <= 300000) fresh.push(row);
  }
  return fresh;
}