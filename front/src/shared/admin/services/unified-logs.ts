import { adminApi, type Transit } from './admin-api'
import type { Underpass } from './underpasses'
export type LogCategory = 'CONTROL' | 'RISK' | 'ALERT' | 'DISPLAY' | 'OTHER'
export interface UnifiedLog { key:string; sourceId:string; facilityId:string; facilityName:string; region:string; category:LogCategory; time:string; text:string; result:string; operator:string; phone:string; carNum:string; message:string; score:number|null }
type EventRecord = {id?:number;kind:string;eventType?:string;createdAt:string;messageType?:string;operatorId?:number;messageText?:string;riskScoreAtEvent?:number}
type AlertRecord = {id:number;underpassId?:number;underpassName?:string;alertType:string;alertTypeLabel?:string;sentAt:string;recipientPhone?:string;carNum?:string;messageText?:string}
export const categoryNames:Record<string,string>={ALL:'전체',CONTROL:'통제·해제',RISK:'위험 변화',ALERT:'알림 발송',DISPLAY:'전광판',OTHER:'기타'}
const events:Record<string,string>={BLOCK:'통제',RELEASE:'통제 해제',RISK_LEVEL_UP:'위험도 상승',RISK_LEVEL_DOWN:'위험도 하락'}
const displays:Record<string,string>={RISK_WARNING:'위험 경고',BLOCK_NOTICE:'차단 안내',RELEASE_NOTICE:'해제 안내'}
export function maskPhone(phone:string){return phone.replace(/(\d{3})[- ]?(\d{3,4})[- ]?(\d{4})/,'$1-****-$3')}
export function dateLabel(value:string){return value&&Number.isFinite(Date.parse(value))?new Date(value).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',hour12:false}):'—'}
export async function eventLogs(item:Underpass,signal:AbortSignal):Promise<UnifiedLog[]>{
 const data=await adminApi<EventRecord[]>(`/underpasses/${encodeURIComponent(item.id)}/events`,{signal})
 if(!Array.isArray(data))throw new Error('이벤트 응답 형식 확인 필요')
 return data.map((row,index)=>{
  const category:LogCategory=row.kind==='DISPLAY'?'DISPLAY':['BLOCK','RELEASE'].includes(row.eventType||'')?'CONTROL':row.eventType?.startsWith('RISK_LEVEL')?'RISK':'OTHER'
  return {key:`event:${item.id}:${row.id??index}:${row.createdAt}:${row.kind}`,sourceId:row.id==null?'서버 ID 미제공':String(row.id),facilityId:item.id,facilityName:item.name,region:item.region,category,time:row.createdAt,text:category==='DISPLAY'?(displays[row.messageType||'']||row.messageType||'전광판 기록'):(events[row.eventType||'']||row.eventType||'시설 이벤트'),result:category==='DISPLAY'?'조작 기록 저장':category==='RISK'?'위험 변화 기록':'이벤트 기록',operator:row.operatorId==null?'정보 없음':`관리자 #${row.operatorId}`,phone:'',carNum:'',message:row.messageText||'',score:row.riskScoreAtEvent??null}
 })
}
export async function alertLogs(items:Underpass[],facilityId:string,page:number,signal:AbortSignal){
 const query=new URLSearchParams({page:String(page),size:'20'})
 if(facilityId)query.set('underpassId',facilityId)
 const data=await adminApi<{items:AlertRecord[];totalPages:number}>(`/alert-logs?${query}`,{signal})
 if(!data||!Array.isArray(data.items)||!Number.isInteger(data.totalPages)||data.totalPages<0)throw new Error('알림 응답 형식 확인 필요')
 return {totalPages:data.totalPages,rows:data.items.map(row=>{
  const f=items.find(item=>item.id===String(row.underpassId))
  return {key:`alert:${row.id}`,sourceId:String(row.id),facilityId:row.underpassId==null?'':String(row.underpassId),facilityName:f?.name||row.underpassName||'—',region:f?.region||'—',category:'ALERT' as const,time:row.sentAt,text:row.alertTypeLabel||({PREDICTIVE:'접근 예측 경고',ROI_FINAL:'진입 직전 최종 경고'}[row.alertType]||'알림 발송'),result:'발송 기록',operator:'정보 없음',phone:row.recipientPhone||'',carNum:row.carNum||'',message:row.messageText||'',score:null}
 })}
}

// Use the same facility-scoped endpoint as the operations screen.
export async function transitLogs(item:Underpass,signal:AbortSignal):Promise<UnifiedLog[]> {
 const data=await adminApi<Transit[]>(`/underpasses/${encodeURIComponent(item.id)}/transits`,{signal})
 if(!Array.isArray(data))throw new Error('차량 통과 응답 형식 확인 필요')
 return data.map(row=>({
  key:`transit:${item.id}:${row.id}`,sourceId:String(row.id),facilityId:item.id,facilityName:item.name,region:item.region,
  category:'OTHER',time:row.exitAt||row.entryAt,text:'차량 통과 기록',
  result:({REMAINING:'잔류',IN_TRANSIT:'통과 중',EXITED:'통과 완료'} as Record<string,string>)[row.status]||'상태 미제공',
  operator:'정보 없음',phone:'',carNum:row.carNum||'',
  message:`진입 ${dateLabel(row.entryAt)} / 출차 ${dateLabel(row.exitAt||'')}`,score:null,
 }))
}
