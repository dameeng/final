import { onBeforeUnmount, onMounted, watch } from "vue";
import type { AppState } from "./use-app";
import { apiBase } from "../services/api";
import { facilities } from "../services/demo";
import { fetchLiveSnapshot, newAlerts, type LiveSnapshot } from "../services/live";
export function useLive(app: AppState) {
  const { state } = app;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let generation = 0, stopped = false;
  let seen = new Set<string>();
  let signature = "";
  let demoSequence = 0;
  let staleMarked = false;
  function apply(snapshot: LiveSnapshot) {
    staleMarked = false;
    const next = JSON.stringify(snapshot.facilities);
    if (next !== signature) {
      signature = next;
      state.liveFacilities = snapshot.facilities;
      state.liveRevision++;
    }
    state.publicAlerts = [...snapshot.alerts].sort((a,b) => Date.parse(b.createdAt)-Date.parse(a.createdAt));
    state.banners.push(...newAlerts(snapshot.alerts, seen, Date.now()));
    state.liveUpdatedAt = Date.now();
    state.now = Date.now();
    state.liveError = "";
  }
  async function poll(token: number) {
    timer = undefined;
    if (stopped || token !== generation || state.demo) return;
    try {
      if (!navigator.onLine) throw new Error("인터넷 연결을 확인해 주세요.");
      const snapshot = await fetchLiveSnapshot();
      if (stopped || token !== generation) return;
      apply(snapshot);
      state.liveStatus = "상태 자동 갱신 중 · 약 30초 간격";
    } catch (e) {
      if (stopped || token !== generation) return;
      state.liveStatus = "연결 지연 · 최신 상태 미확인";
      state.liveError = (e as Error).message;
      // 지하차도 응답에 updatedAt이 없어 시설별 5분 경과 판정을 할 수 없습니다.
      // 대신 마지막 수신 후 5분이 지나면 모든 시설을 "미확인"으로 바꿔 오래된 상태를 보여주지 않습니다.
      if (!staleMarked && state.liveFacilities && state.liveUpdatedAt && Date.now() - state.liveUpdatedAt > 300000) {
        staleMarked = true;
        signature = "";
        state.liveFacilities = state.liveFacilities.map((f) => ({ ...f, status: "UNKNOWN" as const }));
        state.liveRevision++;
      }
    } finally {
      if (!stopped && token === generation && !state.demo)
        timer = setTimeout(() => void poll(token), 30000);
    }
  }
  function restart() {
    clearTimeout(timer);
    const token = ++generation;
    seen = new Set(); signature = ""; staleMarked = false;
    state.banners = []; state.publicAlerts = []; state.liveFacilities = null;
    state.liveUpdatedAt = null; state.liveError = "";
    if (state.demo) {
      apply({ facilities: structuredClone(facilities), alerts: [] });
      state.liveStatus = "시연 모드 · 이 기기에서만 동작";
    } else if (!apiBase) {
      state.liveStatus = "서버 미연결";
      state.liveError = "상태와 알림을 받으려면 서비스 연결이 필요합니다.";
    } else {
      state.liveStatus = "연결 중";
      void poll(token);
    }
  }
  function demoEvent(blocked: boolean) {
    if (!state.demo) return;
    const now = new Date().toISOString();
    const current = state.liveFacilities || facilities;
    const snapshot: LiveSnapshot = {
      facilities: current.map((f, i) => i === 0 ? {
        ...f, status: blocked ? "BLOCKED" : "OPEN", waterLevel: blocked ? 35 : 0, updatedAt: now,
      } : { ...f }),
      alerts: [{ id: "local-" + Date.now() + "-" + (++demoSequence), title: blocked ? "[시연] 침수 위험 · 통제" : "[시연] 통제 해제",
        content: current[0].name + (blocked ? " 통제 상황입니다. 실제 재난 정보가 아닙니다." : " 통제를 해제했습니다. 실제 재난 정보가 아닙니다."),
        createdAt: now, read: false, underpassId: current[0].id }, ...state.publicAlerts].slice(0,100),
    };
    apply(snapshot);
  }
  watch(() => state.demo, restart);
  function resume() {
    // 진행 중인 요청과 중복하지 않고 다음 주기를 앞당깁니다.
    if (document.visibilityState !== "visible" || state.demo || !apiBase || !timer) return;
    clearTimeout(timer); timer = undefined;
    void poll(generation);
  }
  onMounted(() => { restart(); document.addEventListener("visibilitychange", resume); });
  onBeforeUnmount(() => { stopped = true; generation++; clearTimeout(timer); document.removeEventListener("visibilitychange", resume); });
  return { demoEvent };
}