import {watch,onBeforeUnmount} from 'vue'
import {api} from '../services/api'
import type {AppState} from './use-app'
// 로그인한 고객 본인의 알림만 내려오므로 사용자 id를 따로 보내지 않습니다(서버가 로그인 정보로 구분).
const POLL_MS=1000,RETRY_MS=5000
export function usePersonalAlerts(app:AppState){
 const {state}=app
 let timer:ReturnType<typeof setTimeout>|undefined,version=0,stopped=false,initialized=false,busy=false,failed=false
 let seen=new Set<string>()
 let signature=''
 async function load(){
  if(busy||stopped||!state.user||state.demo)return
  const seq=version;busy=true;failed=false
  // 1초마다 "확인 중" 문구가 깜빡이지 않도록 첫 조회에만 로딩 표시
  if(!initialized)state.personalLoading=true
  try{
   const rows=await api.alerts()
   if(stopped||seq!==version)return
   rows.sort((a,b)=>(Date.parse(b.createdAt)||0)-(Date.parse(a.createdAt)||0))
   // 첫 조회는 기존 알림을 기록만 하고, 이후 새로 생긴 알림만 팝업으로 띄웁니다.
   if(initialized)state.personalBanners.push(...rows.filter(row=>!seen.has(row.id)).reverse())
   rows.forEach(row=>seen.add(row.id));initialized=true
   const next=rows.map(row=>row.id).join(',')
   if(next!==signature){signature=next;state.personalAlerts=rows}
   state.personalError=''
  }catch(e){if(seq===version){state.personalError=(e as Error).message;failed=true}}
  finally{if(seq===version){busy=false;state.personalLoading=false;if(!stopped)timer=setTimeout(()=>void load(),failed?RETRY_MS:POLL_MS)}}
 }
 watch(()=>[state.user?.id,state.demo],()=>{
  version++;clearTimeout(timer);busy=false;initialized=false;signature='';seen=new Set();state.personalAlerts=[];state.personalBanners=[];state.personalError='';state.personalLoading=false
  void load()
 },{immediate:true})
 onBeforeUnmount(()=>{stopped=true;version++;clearTimeout(timer)})
 return {refresh:()=>{clearTimeout(timer);void load()}}
}