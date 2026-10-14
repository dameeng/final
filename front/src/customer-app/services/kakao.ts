let pending: Promise<any> | null = null;
const fallbackKey = '5e63dfabf16ffc6cde7a3831d301be65';
export function loadKakao(): Promise<any> {
  const key = import.meta.env.VITE_KAKAO_JAVASCRIPT_KEY || fallbackKey;
  const existing = (window as any).kakao?.maps;
  if (existing?.services?.Places) return Promise.resolve(existing);
  if (pending) return pending;
  pending = new Promise((resolve, reject) => {
    const url = 'https://dapi.kakao.com/v2/maps/sdk.js?appkey=' + encodeURIComponent(key) + '&libraries=services&autoload=false';
    const script = document.querySelector<HTMLScriptElement>('script[src*="dapi.kakao.com/v2/maps/sdk.js"]') || document.createElement('script');
    let settled = false;
    const cleanup = () => { clearInterval(poll); clearTimeout(timer); script.removeEventListener('error', fail); };
    const fail = () => { if (settled) return; settled = true; cleanup(); pending = null; reject(new Error('카카오 지도를 불러오지 못했습니다. 앱 도메인의 지도 API 등록과 인터넷 연결을 확인해 주세요.')); };
    const check = () => {
      const kakao = (window as any).kakao;
      if (!kakao?.maps?.load) return;
      kakao.maps.load(() => {
        if (settled) return;
        if (!kakao.maps.services?.Places) { fail(); return; }
        settled = true; cleanup(); resolve(kakao.maps);
      });
    };
    script.addEventListener('error', fail);
    const poll = window.setInterval(check, 100);
    const timer = window.setTimeout(fail, 15000);
    if (!script.src) { script.src = url; script.async = true; document.head.appendChild(script); }
    check();
  });
  return pending;
}
