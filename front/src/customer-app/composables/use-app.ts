import { inject, type InjectionKey, reactive } from "vue";
import type { User, Facility, Alert } from "../services/types";
import { api } from "../services/api";
function saved<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(sessionStorage.getItem(key) || "null") ?? fallback;
  } catch {
    return fallback;
  }
}
// 관심 지하차도: api 없음 (프로젝트에 favorites 컨트롤러가 없음).
// 서버에 저장되지 않고 이 기기(localStorage)에 계정별로만 저장합니다.
function favoriteKey(userId: string) {
  return "routel-app-favorites-" + userId;
}
function readFavorites(userId: string): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(favoriteKey(userId)) || "[]");
    return Array.isArray(value) ? value.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}
function writeFavorites(userId: string, ids: string[]) {
  try {
    localStorage.setItem(favoriteKey(userId), JSON.stringify(ids));
  } catch {}
}
export function createAppState() {
  const state = reactive({
    demo: saved<boolean>("routel-app-demo", false) === true,
    user: null as User | null,
    favorites: [] as string[],
    readIds: [] as string[],
    online: navigator.onLine,
    now: Date.now(),
    liveFacilities: null as Facility[] | null,
    publicAlerts: [] as Alert[],
    banners: [] as Alert[],
    personalAlerts: [] as Alert[],
    personalBanners: [] as Alert[],
    personalLoading:false,
    personalError:"",
    liveRevision: 0,
    liveStatus: "연결 준비 중",
    liveError: "",
    liveUpdatedAt: null as number | null,
  });
  let generation = 0;
  function setDemo(value: boolean) {
    generation++;
    state.demo = value;
    state.user = null;
    state.favorites = [];
    state.readIds = [];
    try {
      sessionStorage.setItem("routel-app-demo", JSON.stringify(value));
    } catch {}
  }
  // 로그인 직후 호출해 현재 사용자의 관심 목록을 불러옵니다.
  function loadFavorites() {
    state.favorites = state.user && !state.demo ? readFavorites(state.user.id) : [];
  }
  async function restore() {
    const current = ++generation;
    if (!state.demo) {
      try {
        const user = await api.me();
        if (current !== generation) return;
        state.user = user;
        state.favorites = readFavorites(user.id);
      } catch {
        if (current === generation) {
          state.user = null;
          state.favorites = [];
        }
      }
    }
  }
  async function favorite(id: string) {
    const next = state.favorites.includes(id)
      ? state.favorites.filter((x) => x !== id)
      : [...state.favorites, id];
    if (!state.demo) {
      if (!state.user)
        throw new Error("관심 등록은 로그인 후 이용할 수 있습니다.");
      writeFavorites(state.user.id, next);
    }
    state.favorites = next;
  }
  return { state, setDemo, restore, favorite, loadFavorites };
}
export type AppState = ReturnType<typeof createAppState>;
export const appKey: InjectionKey<AppState> = Symbol("routel-app");
export function useApp() {
  const app = inject(appKey);
  if (!app) throw new Error("App provider missing");
  return app;
}