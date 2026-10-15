import {normalizeNotification,type NotificationPayload} from './notification-format';
import type { Facility, Notice, User, Weather } from "./types";
export const apiBase = (import.meta.env.VITE_API_BASE_URL || window.location.origin).replace(
  /\/$/,
  "",
);
export async function request<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  if (!apiBase)
    throw new Error(
      "아직 서비스에 연결되지 않았습니다. 화면을 확인하려면 하단 앱 설정에서 시연 모드를 선택하세요.",
    );
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(apiBase + path, {
      method,
      credentials: "include",
      signal: controller.signal,
      cache: "no-store",
      headers: {
        Accept: "application/json",
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if(response.status===401)window.dispatchEvent(new Event('routel-app-session-expired'));
    if (response.status === 204 && response.ok) return undefined as T;
    const json = await response.json().catch(() => null);
    if (!response.ok || json?.success === false)
      throw new Error(
        json?.message ||
          (response.status === 401
            ? "로그인이 필요합니다."
            : "요청을 처리하지 못했습니다."),
      );
    if (!json || json.success !== true || !("data" in json))
      throw new Error("서버 응답 형식이 맞지 않습니다.");
    return json.data as T;
  } catch (error) {
    if (controller.signal.aborted)
      throw new Error("응답 시간이 초과되었습니다. 다시 시도해 주세요.");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

type Row = Record<string, unknown>;

// ===== 지하차도 (GET /api/underpasses, GET /api/underpasses/{id} · 로그인 없이 공개) =====
export function toFacility(row: Row): Facility {
  return {
    id: String(row.id),
    name: String(row.name),
    // 목록 응답은 regionName을 주고, 상세 응답에는 regionId만 있습니다.
    region: String(row.regionName ?? row.regionId ?? ''),
    address: String(row.roadAddress ?? ''),
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    // 백엔드 currentStatus는 NORMAL/BLOCKED, currentRiskLevel은 SAFE/WARNING/DANGER 입니다.
    status: row.currentStatus === 'BLOCKED' ? 'BLOCKED'
      : row.currentRiskLevel === 'WARNING' || row.currentRiskLevel === 'DANGER' ? 'CAUTION'
      : (row.currentStatus === 'NORMAL' || row.currentStatus === 'OPEN') && row.currentRiskLevel === 'SAFE' ? 'OPEN'
      : 'UNKNOWN',
    // 관측 수위: 응답에 없음 (목록·상세 응답 모두 수위 필드가 없고 riskScore만 있습니다).
    waterLevel: null,
    // 기준 시각: 응답에 없음 (createdAt만 있고 updatedAt이 없습니다). 빈 값이면 화면에 "기준 시각 미제공"으로 표시됩니다.
    updatedAt: '',
  };
}
// PageParams 최대 size가 100이라 100개씩 나눠서 모두 받아옵니다.
export async function fetchFacilities(): Promise<Facility[]> {
  const rows: Row[] = [];
  for (let page = 1; page <= 50; page++) {
    const result = await request<{ items: Row[]; totalPages: number }>(`/api/underpasses?page=${page}&size=100`);
    if (!result || !Array.isArray(result.items)) throw new Error("현황 응답 형식이 맞지 않습니다.");
    rows.push(...result.items);
    if (page >= (result.totalPages || 1)) break;
  }
  return rows.map(toFacility);
}

// ===== 공지사항 (GET /api/notices, GET /api/notices/{id} · 로그인 없이 공개) =====
function toNotice(row: Row): Notice {
  return {
    id: String(row.id),
    title: String(row.title ?? ''),
    // 목록 응답(NoticeListItem)에는 content가 없어서 ''입니다. 본문은 api.notice(id)로 받습니다.
    content: String(row.content ?? ''),
    createdAt: String(row.createdAt ?? ''),
    important: row.important === true,
  };
}

// ===== 로그인·회원가입 (/api/customers/**) =====
export interface SignupInput {
  loginId: string;
  password: string;
  passwordConfirm: string;
  name: string;
  birthDate: string; // yyyy-MM-dd
  email: string;
  phone: string;
  emergency: string; // 선택 항목: 빈 문자열이면 생략
  zipcode: string;
  roadAddress: string;
  detailAddress: string; // 선택 항목
}
const me = async (): Promise<User> => {
  const p = await request<{ id: number; loginId: string; name: string; email: string }>("/api/customers/me");
  return { id: String(p.id), loginId: p.loginId, name: p.name, email: p.email ?? '' };
};

export const api = {
  facilities: fetchFacilities,
  facility: async (id: string) => toFacility(await request<Row>("/api/underpasses/" + encodeURIComponent(id))),
  notices: async () => {
    const items: Notice[] = [];
    for (let page = 1; page <= 100; page++) {
      const result = await request<{ items: Row[]; totalPages: number }>(`/api/notices?page=${page}&size=100`);
      items.push(...result.items.map(toNotice));
      if (page >= (result.totalPages || 1)) break;
    }
    return items;
  },
  notice: async (id: string) => toNotice(await request<Row>("/api/notices/" + encodeURIComponent(id))),
  // 로그인한 고객 본인의 알림(최신순). 서버가 로그인 정보로 사용자를 구분하므로 id를 보내지 않습니다.
  alerts: async (alertType?: "PREDICTIVE" | "ROI_FINAL") => {
    const query = new URLSearchParams({ page: "1", size: "20" });
    if (alertType) query.set("alertType", alertType);
    const data = await request<{ items: NotificationPayload[] }>("/api/customers/me/alerts?" + query.toString());
    if (!data || !Array.isArray(data.items)) throw new Error('개인 알림 응답 형식을 확인해 주세요.');
    return data.items.map(normalizeNotification);
  },
  // 알림 읽음 처리: api 없음 (읽음 PATCH 엔드포인트가 없고 MyAlertItem에도 read 필드가 없습니다).
  me,
  // 로그인 응답(id, loginId, name)에는 email이 없어서 내 정보 조회로 보완합니다.
  login: async (loginId: string, password: string) => {
    await request<{ id: number; loginId: string; name: string }>("/api/customers/login", "POST", { loginId, password });
    return me();
  },
  signup: (body: SignupInput) => request<void>("/api/customers/signup", "POST", body),
  checkLoginId: async (loginId: string) =>
    (await request<{ available: boolean }>("/api/customers/check-login-id?loginId=" + encodeURIComponent(loginId))).available,
  sendEmailCode: (email: string) => request<void>("/api/customers/email-code/send", "POST", { email }),
  verifyEmailCode: (email: string, code: string) => request<void>("/api/customers/email-code/verify", "POST", { email, code }),
  logout: () => request<void>("/api/auth/logout", "POST"),
  // 날씨: 백엔드는 위경도 기준으로 가장 가까운 날씨 지역을 찾아 줍니다.
  weather: (lat: number, lng: number) => request<Weather>(`/api/weather?lat=${lat}&lng=${lng}`),
  // 관심 지하차도: api 없음 (프로젝트에 favorites 컨트롤러가 없음) → use-app.ts에서 이 기기 저장소를 사용합니다.
  // 푸시 구독: api 없음 (push-subscriptions 컨트롤러가 없음) → push.ts 참고.
};