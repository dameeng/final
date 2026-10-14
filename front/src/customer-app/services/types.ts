export interface Facility {
  id: string;
  name: string;
  region: string;
  address: string;
  latitude: number;
  longitude: number;
  status: "OPEN" | "CAUTION" | "BLOCKED" | "UNKNOWN";
  waterLevel: number | null;
  updatedAt: string;
}
export interface Notice {
  id: string;
  title: string;
  // 공지 목록 응답(NoticeListItem)에는 본문이 없어 목록에서는 '' 입니다. 본문은 상세 응답(/api/notices/{id})에만 있습니다.
  content: string;
  createdAt: string;
  important?: boolean;
}
export interface Alert {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  read: boolean;
  readSupported?:boolean;
  underpassName?:string;
  carNum?:string;
  recipientPhone?:string;
  alertType?:string;
  underpassId?: string;
}
export interface User {
  id: string;
  name: string;
  email: string;
  loginId?: string;
}
// 날씨 응답(WeatherResponse) 그대로의 모양입니다. 기상 안내(advisory)와 현재 강수 확률은 응답에 없습니다.
export interface WeatherHour {
  time: string;
  temperature: number | null;
  rainfall: number | null;
  precipitationProbability: number | null;
}
export interface WeatherDay {
  date: string;
  minTemperature: number | null;
  maxTemperature: number | null;
  precipitationProbability: number | null;
}
export interface Weather {
  areaName: string;
  temperature: number | null;
  humidity: number | null;
  rainfall: number | null;
  condition: string | null;
  observedAt: string | null;
  hourly: WeatherHour[];
  daily: WeatherDay[];
}