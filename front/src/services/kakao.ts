declare global {interface Window {kakao:any}}
let loading:Promise<any>|undefined
export function loadKakao():Promise<any>{
 if(window.kakao?.maps?.Map)return Promise.resolve(window.kakao)
 if(loading)return loading
 const key=import.meta.env.VITE_KAKAO_MAP_KEY
 if(!key)return Promise.reject(new Error('카카오 지도 키가 없습니다. .env에 VITE_KAKAO_MAP_KEY를 설정하세요.'))
 loading=new Promise((resolve,reject)=>{
  const script=document.createElement('script');let settled=false
  const fail=(message:string)=>{if(settled)return;settled=true;clearTimeout(timer);loading=undefined;script.remove();reject(new Error(message))}
  const timer=setTimeout(()=>fail('지도를 불러오는 데 시간이 걸립니다. 네트워크를 확인하고 다시 시도해 주세요.'),15000)
  script.src=`https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&autoload=false&libraries=services,clusterer`
  script.onload=()=>{
   if(settled)return
   if(!window.kakao?.maps){fail('카카오 SDK를 사용할 수 없습니다. 키와 허용 도메인을 확인하세요.');return}
   window.kakao.maps.load(()=>{if(settled)return;settled=true;clearTimeout(timer);resolve(window.kakao)})
  }
  script.onerror=()=>fail('지도 SDK 로딩 실패. 네트워크와 도메인 설정을 확인하세요.')
  document.head.append(script)
 })
 return loading
}
export async function geocode(address:string):Promise<{lat:number;lng:number}>{const k=await loadKakao();return new Promise((resolve,reject)=>new k.maps.services.Geocoder().addressSearch(address,(result:any,status:any)=>{if(status!==k.maps.services.Status.OK||!result.length)reject(new Error('주소를 찾지 못했습니다.'));else resolve({lat:Number(result[0].y),lng:Number(result[0].x)})}))}
