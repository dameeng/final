import type { Facility, Notice, Alert } from "./types";
// 모든 이름·수위·상태는 실제 관측과 관계없는 고정 시연 자료입니다.
export const facilities: Facility[] = [
  {
    id: "demo-1",
    name: "시연 서울 A 지하차도",
    region: "서울",
    address: "시연 위치 · 서울",
    latitude: 37.5665,
    longitude: 126.978,
    status: "OPEN",
    waterLevel: 0,
    updatedAt: "2026-09-17T09:00:00+09:00",
  },
  {
    id: "demo-2",
    name: "시연 서울 B 지하차도",
    region: "서울",
    address: "시연 위치 · 서울",
    latitude: 37.54,
    longitude: 127.02,
    status: "BLOCKED",
    waterLevel: 35,
    updatedAt: "2026-09-17T09:00:00+09:00",
  },
  {
    id: "demo-3",
    name: "시연 부산 C 지하차도",
    region: "부산",
    address: "시연 위치 · 부산",
    latitude: 35.1796,
    longitude: 129.0756,
    status: "CAUTION",
    waterLevel: 10,
    updatedAt: "2026-09-17T09:00:00+09:00",
  },
];
export const notices: Notice[] = [
  {
    id: "demo-notice-1",
    title: "[시연] ROUTEL 이용 안내",
    content:
      "지도와 목록에서 지하차도를 조회할 수 있습니다. 이 모드의 상태와 알림은 시연용입니다.",
    createdAt: "2026-09-17T09:00:00+09:00",
  },
  {
    id: "demo-notice-2",
    title: "[시연] 관심 지하차도 등록",
    content: "지하차도 상세 화면에서 관심 등록을 눌러 보세요.",
    createdAt: "2026-09-16T09:00:00+09:00",
  },
];
export const alerts: Alert[] = [
  {
    id: "demo-alert-1",
    title: "[시연] 지하차도 통제 안내",
    content:
      "시연 서울 B 지하차도의 통제 알림입니다. 실제 통제 정보가 아닙니다.",
    createdAt: "2026-09-17T09:00:00+09:00",
    read: false,
    underpassId: "demo-2",
  },
];
