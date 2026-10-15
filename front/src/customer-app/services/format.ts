import type { Facility } from "./types";
export function time(value: string) {
  const n = Date.parse(value);
  return Number.isFinite(n)
    ? new Date(n).toLocaleString("ko-KR")
    : "기준 시각 미제공";
}
export function status(row: Facility, demo = false, now = Date.now()) {
  // 지하차도 목록·상세 응답에 updatedAt이 없어 기준 시각이 빈 값이면 5분 경과 판정을 건너뜁니다.
  // 연결이 끊긴 경우는 use-live.ts가 마지막 수신 5분 후 모든 시설을 "미확인"으로 바꿉니다.
  if (!demo && row.updatedAt) {
    const updated = Date.parse(row.updatedAt);
    if (!Number.isFinite(updated) || now - updated > 300000) return "최신 상태 미확인";
  }
  return (
    (
      {
        OPEN: "정상",
        CAUTION: "주의",
        BLOCKED: "통제",
        UNKNOWN: "미확인",
      } as Record<string, string>
    )[row.status] || "미확인"
  );
}