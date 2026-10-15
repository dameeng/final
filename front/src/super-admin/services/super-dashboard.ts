import { reactive, ref, computed, onBeforeUnmount } from 'vue'
import { adminApi, type Region } from '../../shared/admin/services/admin-api'
import type { Underpass } from '../../shared/admin/services/underpasses'
import { normalizeRegion } from '../../shared/admin/utils/region-risk'

// Header and the mounted super dashboard share only request/status signals, not authentication.
export const superDashboardStatus = reactive({ refreshVersion: 0, loading: false, errors: [] as string[], updatedAt: null as string|null })
export type Manager = {id:number;name:string;loginId:string;role:string;status:string;regionId:number|null;regionName:string|null}
export type Pending = {id:number;name:string;loginId:string;createdAt:string}
export type AlertRow = {id:number;underpassId:number;alertType:string;sentAt:string}
export type EventRow = {kind:string;eventType:string|null;operatorId:number|null;createdAt:string;riskScoreAtEvent:number|null}
export type Threshold = {level:string;riskScoreMin:number;updatedAt:string|null}
export type RiskPoint = {riskScore:number|null;predictedAt:string}
export type Sample = {id:string;events:EventRow[]|null;thresholds:Threshold[]|null;risks:RiskPoint[]|null;errors:string[];updatedAt:string}
export const eventLabels: Record<string,string> = {BLOCK:'통제',RELEASE:'통제 해제',RISK_LEVEL_UP:'위험도 상승',RISK_LEVEL_DOWN:'위험도 하락'}
export const timeLabel = (value?:string|null) => !value || !Number.isFinite(Date.parse(value)) ? '—' : new Date(value).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',hour12:false})
export const regionOf = (item:Underpass) => normalizeRegion(item.region)
export const unassigned = (item:{regionId?:number|null;region?:string;regionName?:string|null}) => item.regionId == null || (item.region ?? item.regionName)?.trim()==='미배정'
export function useSuperData() {
 const regions=ref<Region[]>([]),managers=ref<Manager[]>([]),pending=ref<Pending[]>([]),alerts=ref<AlertRow[]>([])
 const errors=ref<Record<string,string>>({}),ready=ref<Record<string,boolean>>({}),complete=ref<Record<string,boolean>>({})
 const loading=ref(false),sampling=ref(false),samples=ref<Record<string,Sample>>({})
 const updated=ref<Record<string,string>>({})
 let disposed=false,controller=new AbortController()
 let sampleController:AbortController|undefined, sampleVersion=0
 const init=()=>({signal:controller.signal})
 async function pages<T>(path:string,maxPages:number){
  const rows:T[]=[]
  for(let page=1;page<=maxPages;page++){
   const d=await adminApi<{items:T[];totalPages:number}>(`${path}${path.includes('?')?'&':'?'}page=${page}&size=20`,init())
   if(!d||!Array.isArray(d.items)||!Number.isInteger(d.totalPages)||d.totalPages<0)throw new Error('응답 형식 확인 필요')
   rows.push(...d.items)
   if(page>=Math.max(1,d.totalPages))return {rows,complete:true}
  }
  return {rows,complete:false}
 }
 function syncStatus(){superDashboardStatus.loading=loading.value||sampling.value;superDashboardStatus.errors=[...Object.entries(errors.value).filter(([,v])=>v).map(([k])=>({regions:'지역 목록',managers:'관리자 목록',pending:'가입 승인',alerts:'알림 기록'}[k]||k)),...Object.values(samples.value).filter(s=>s.errors.length).map(s=>`시설 #${s.id}`)]}
 async function load(){
  if(loading.value||disposed)return
  loading.value=true;syncStatus()
  const tasks = [
   ['regions',async()=>{const r=await adminApi<Region[]>('/regions',init());if(!Array.isArray(r))throw new Error('응답 형식');regions.value=r;complete.value.regions=true}],
   ['managers',async()=>{const r=await pages<Manager>('/managers?status=ACTIVE',20);managers.value=r.rows;complete.value.managers=r.complete}],
   ['pending',async()=>{const r=await pages<Pending>('/managers/pending',20);pending.value=r.rows;complete.value.pending=r.complete}],
   ['alerts',async()=>{const r=await pages<AlertRow>('/alert-logs',5);alerts.value=r.rows;complete.value.alerts=r.complete}],
  ] as const
  // Pagination is sequential within a resource; no facility fan-out on polling.
  await Promise.allSettled(tasks.map(async([key,task])=>{try{await task();if(disposed)return;ready.value[key]=true;errors.value[key]='';updated.value[key]=new Date().toISOString();superDashboardStatus.updatedAt=updated.value[key]}catch(e){if(!disposed)errors.value[key]=e instanceof Error?e.message:'조회 실패'}}))
  if(disposed)return
  loading.value=false;syncStatus()
 }
 async function loadSamples(items:Underpass[],reset=false){
  if(disposed)return
  sampleController?.abort()
  const requestController=new AbortController();sampleController=requestController
  const seq=++sampleVersion
  const ids=[...items].filter(item=>reset||!samples.value[item.id]||samples.value[item.id].errors.length)
  sampling.value=true;syncStatus()
  try{
   for(let i=0;i<ids.length;i+=2){
    await Promise.allSettled(ids.slice(i,i+2).map(async item=>{
     const previous=samples.value[item.id]
     const row:Sample={id:item.id,events:previous?.events??null,thresholds:previous?.thresholds??null,risks:previous?.risks??null,errors:[],updatedAt:previous?.updatedAt||''}
     const keys=['events','thresholds','risks'] as const
     // 두 시설을 처리하되 시설별 API는 순차 실행하여 기록 요청 최대 2개 유지.
     for(const key of keys){
      if(disposed||seq!==sampleVersion)return
      try{
       const suffix=key==='risks'?'risk-scores?hours=24':key
       const result=await adminApi<unknown[]>(`/underpasses/${encodeURIComponent(item.id)}/${suffix}`,{signal:requestController.signal})
       if(!Array.isArray(result))throw new Error('응답 형식 확인 필요')
       ;(row[key] as unknown[])=result
       row.updatedAt=new Date().toISOString()
      }catch{
       if(disposed||seq!==sampleVersion)return
       row.errors.push({events:'이벤트',thresholds:'임계치',risks:'위험도'}[key])
      }
     }
     if(disposed||seq!==sampleVersion)return
     samples.value={...samples.value,[item.id]:row};syncStatus()
    }))
    if(disposed||seq!==sampleVersion)return
   }
  }finally{
   if(!disposed&&seq===sampleVersion){sampling.value=false;syncStatus()}
  }
 }
 const pendingCount=computed(()=>ready.value.pending&&!errors.value.pending&&complete.value.pending?pending.value.length:null)
 const activeCount=computed(()=>ready.value.managers&&!errors.value.managers&&complete.value.managers?managers.value.filter(m=>m.status==='ACTIVE').length:null)
 onBeforeUnmount(()=>{disposed=true;controller.abort();sampleVersion++;sampleController?.abort();superDashboardStatus.loading=false;superDashboardStatus.errors=[];superDashboardStatus.updatedAt=null})
 return {regions,managers,pending,alerts,errors,ready,complete,loading,sampling,samples,updated,pendingCount,activeCount,load,loadSamples}
}
