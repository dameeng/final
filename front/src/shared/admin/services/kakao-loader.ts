let sdkRequest: Promise<void> | undefined
export function loadRegionalKakaoSdk(key: string): Promise<void> {
  if (window.kakao?.maps?.load) return new Promise(resolve => window.kakao.maps.load(resolve))
  if (sdkRequest) return sdkRequest
  sdkRequest = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[src*="dapi.kakao.com/v2/maps/sdk.js"]')
    const script = existing || document.createElement('script')
    const timeout = window.setTimeout(() => finish(new Error('지도 연결 시간이 초과되었습니다.')), 12000)
    const failed = () => finish(new Error('지도를 불러오지 못했습니다.'))
    const loaded = () => {
      if (window.kakao?.maps?.load) window.kakao.maps.load(() => finish())
      else finish(new Error('지도 SDK를 확인해 주세요.'))
    }
    function finish(error?: Error) {
      window.clearTimeout(timeout)
      script.removeEventListener('load', loaded); script.removeEventListener('error', failed)
      if (error) { if (!existing) script.remove(); reject(error) } else resolve()
    }
    script.addEventListener('load', loaded, { once: true }); script.addEventListener('error', failed, { once: true })
    if (!existing) {
      script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&autoload=false`
      script.async = true
      document.head.appendChild(script)
    }
  }).catch(error => { sdkRequest = undefined; throw error })
  return sdkRequest
}
