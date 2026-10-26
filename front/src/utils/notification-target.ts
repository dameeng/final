import type { RouteLocationRaw } from 'vue-router'
import { managerAppPath } from './manager-app-path'

export function notificationTarget(
  item: {id:number;refType?:string;refId?:number|string},
  manager:boolean,
  currentPath:string,
  historyPath:string,
):RouteLocationRaw {
  const id=Number(item.refId), type=String(item.refType || '').toUpperCase()
  const mobile=currentPath.startsWith('/customer-app/')
  const target=(path:string)=>manager?managerAppPath(path,currentPath):path
  const detail=(path:string)=>({path:target(path),query:{id:String(id)}})
  if(Number.isSafeInteger(id)&&id>0) {
    if(type==='UNDERPASS')return detail(manager?'/fac-detail':mobile?'/customer-app/screen-5':'/c-map')
    if(type==='NOTICE')return detail(manager?'/admin-data/notices':mobile?'/customer-app/notices':'/c-notice')
    if(type==='INQUIRY')return detail(manager?'/admin-data/inquiries':mobile?'/customer-app/account/inquiries':'/my-inquiries')
    if(manager) {
      if(type==='PM_EQUIPMENT')return detail('/pm-equipment-detail')
      if(type==='PM_EVENT')return {path:target('/pm-queue'),query:{eventId:String(id)}}
      if(type==='PLATE_LOG')return detail('/admin-data/ocr')
    }
  }
  if(manager&&type==='PM_REPORT')return {path:target('/pm-history')}
  const fallback=manager&&currentPath.startsWith('/admin-app/')?'/admin-app/notifications':mobile?'/customer-app/screen-12':historyPath
  return {path:fallback,query:{notification:String(item.id)}}
}
