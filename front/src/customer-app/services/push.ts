import { apiBase, request } from "./api";
import pushWorkerUrl from "../workers/push-worker.js?worker&url";
// 푸시 구독: api 없음. 프로젝트 백엔드에 push-subscriptions 컨트롤러가 없고 SecurityConfig에도 이 경로가 없습니다.
// 백엔드가 생기면 pushAvailable을 true로 바꾸고 아래 경로를 실제 주소로 고치세요.
export const pushAvailable = false;
const noApiMessage = "푸시 알림 구독 API가 아직 없어 사용할 수 없습니다.";
const subscriptionPath = "/api/v1/public/push-subscriptions";
function workerURL() { return new URL(pushWorkerUrl, location.href); }
async function registration() {
  // 기본 assets 폴더 scope에 등록되어 기존 루트 PWA 워커와 공존합니다.
  const reg = await navigator.serviceWorker.register(workerURL().href);
  if (reg.active) return reg;
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => done(new Error("알림 준비 시간이 초과되었습니다. 새로고침 후 다시 시도해 주세요.")), 12000);
    const worker = reg.installing || reg.waiting;
    function done(error?: Error) {
      clearTimeout(timer); worker?.removeEventListener("statechange", check);
      if (error) reject(error); else resolve();
    }
    function check() {
      if (reg.active || worker?.state === "activated") done();
      else if (worker?.state === "redundant") done(new Error("푸시 수신 준비에 실패했습니다."));
    }
    worker?.addEventListener("statechange", check); check();
  });
  return reg;
}
function supported() {
  if (!window.isSecureContext || !("serviceWorker" in navigator) ||
      !("PushManager" in window) || !("Notification" in window))
    throw new Error("푸시를 지원하는 HTTPS 환경에서 이용해 주세요. 아이폰은 홈 화면에 추가한 앱에서 실행해 주세요.");
}
export async function enablePush() {
  if (!pushAvailable) throw new Error(noApiMessage);
  supported();
  if (import.meta.env.DEV) throw new Error("휴대폰 푸시는 빌드한 앱을 HTTPS로 배포한 뒤 확인해 주세요. 개발 화면에서는 화면 알림을 확인할 수 있습니다.");
  const key = import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY;
  if (!apiBase || !key) throw new Error("푸시 알림 서비스가 아직 연결되지 않았습니다.");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("알림 권한이 허용되지 않았습니다. 브라우저 설정에서 변경할 수 있습니다.");
  const reg = await registration();
  const existing = await reg.pushManager.getSubscription();
  const raw = atob(key.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(key.length / 4) * 4, "="));
  const bytes = Uint8Array.from(raw, (c) => c.charCodeAt(0));
  const subscription = existing || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes });
  try { await request(subscriptionPath, "POST", subscription.toJSON()); }
  catch (e) { if (!existing) await subscription.unsubscribe(); throw e; }
}
export async function disablePush() {
  if (!pushAvailable) throw new Error(noApiMessage);
  if (!("serviceWorker" in navigator)) return;
  const url = workerURL();
  const reg = await navigator.serviceWorker.getRegistration(new URL("./", url).href);
  // getRegistration의 상위 scope 매칭으로 기존 PWA 구독을 해제하지 않도록 검증합니다.
  if (!reg || reg.scope !== new URL("./", url).href) return;
  const subscription = await reg.pushManager.getSubscription();
  if (!subscription) return;
  // 서버 제거가 실패해도 브라우저 수신 권한은 즉시 구독 해제로 반영합니다.
  let failure: unknown;
  try { await request(subscriptionPath, "DELETE", { endpoint: subscription.endpoint }); }
  catch (e) { failure = e; }
  await subscription.unsubscribe();
  if (failure) throw new Error("이 기기의 구독은 해제했지만 서버 정리에 실패했습니다. 서버는 만료 구독을 제거해야 합니다.");
}