import type {Alert} from './types'
export type NotificationPayload={id:string|number;underpassName?:string;carNum?:string;recipientPhone?:string;alertType?:string;alertTypeLabel?:string;sentAt?:string;messageText?:string;title?:string;content?:string;createdAt?:string;read?:boolean;underpassId?:string|number}
export function normalizeNotification(row:NotificationPayload):Alert{
 if(row.id==null)throw new Error('알림 ID를 확인할 수 없습니다.')
 return {id:String(row.id),title:row.alertTypeLabel||row.title||'알림',content:row.messageText??row.content??'내용 없음',createdAt:row.sentAt||row.createdAt||'',read:row.read===true,readSupported:typeof row.read==='boolean',underpassId:row.underpassId==null?undefined:String(row.underpassId),underpassName:row.underpassName,carNum:row.carNum,recipientPhone:row.recipientPhone,alertType:row.alertType}
}
export function maskPhone(phone?:string){
 if(!phone)return '정보 없음'
 const digits=phone.replace(/\D/g,'')
 return digits.length>=9?`${digits.slice(0,digits.length===10?2:3)}-****-${digits.slice(-4)}`:'정보 없음'
}
export function sentTime(value:string){
 // Offset-free server values remain wall-clock text until the server timezone contract is confirmed.
 if(!value)return '정보 없음'
 const wall=value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}:\d{2}:\d{2})(?:\.\d+)?$/)
 if(wall)return `${wall[1]}.${wall[2]}.${wall[3]} ${wall[4]}`
 const date=new Date(value)
 return Number.isFinite(date.getTime())?date.toLocaleString('ko-KR',{timeZone:'Asia/Seoul',hour12:false}):'정보 없음'
}
