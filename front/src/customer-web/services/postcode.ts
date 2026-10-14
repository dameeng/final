type PostcodeResult = { zonecode: string; roadAddress: string; address: string }
type PostcodeWindow = Window & { kakao?: { Postcode?: new (options: { oncomplete: (result: PostcodeResult) => void }) => { open: () => void } } }
let loading: Promise<void> | null = null
export function openPostcode(onComplete: (result: PostcodeResult) => void): Promise<void> {
  const external = window as PostcodeWindow
  if (!loading) loading = external.kakao?.Postcode ? Promise.resolve() : new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://t1.kakaocdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js'
    script.onload = () => external.kakao?.Postcode ? resolve() : reject(new Error('주소 검색을 불러오지 못했습니다.'))
    script.onerror = () => reject(new Error('주소 검색 연결을 확인해 주세요.'))
    document.head.appendChild(script)
  }).catch((error) => { loading = null; throw error })
  return loading.then(() => { const Postcode = external.kakao?.Postcode; if (!Postcode) throw new Error('주소 검색을 사용할 수 없습니다.'); new Postcode({ oncomplete: onComplete }).open() })
}
