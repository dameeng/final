import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { adminSidebarGroups } from '../data/adminSidebar'
import { useApp } from './app'

const icons = [
  'M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3V6Zm6-3v15m6-12v15',
  'M14 6a5 5 0 0 0-6 6l-5 5a2 2 0 0 0 4 4l5-5a5 5 0 0 0 6-6l-3 3-4-4 3-3Z',
  'M3 8V4h4m10 0h4v4M3 16v4h4m10 0h4v-4M6 10h12v5H6v-5Zm3 0v5m6-5v5',
  'M12 3 3 7v5c0 5 9 9 9 9s9-4 9-9V7l-9-4Zm-4 9h8m-3-3 3 3-3 3',
  'M5 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-6 3V6a2 2 0 0 1 2-2Zm2 5h10M7 13h6',
  'M4 5h16v14H4V5Zm4-3v6m8-6v6M4 10h16m-12 4h2m4 0h2',
]
export const shortcutGroups = adminSidebarGroups.map((group,index)=>({
  title:group.title,
  items:group.links.map(([label,preview,path])=>({label:label!,to:(preview||path)!,icon:icons[index]!})),
}))
shortcutGroups[4]!.items.push({label:'챗봇 대화 로그',to:'/bot-logs',icon:icons[4]!})
const catalog=shortcutGroups.flatMap(group=>group.items)
const defaults=['/fac-list','/pm-equipment','/admin-data/ocr','/verify','/admin-data/transfers','/bot-logs']
export const useDashboardShortcuts=defineStore('dashboard-shortcuts',()=>{
  const app=useApp(), order=ref([...defaults]), editing=ref(false), requestEdit=ref(0), error=ref('')
  const storageKey=computed(()=>`routel-dashboard-shortcuts-v1:${app.account?.role||'guest'}:${app.account?.id||'guest'}`)
  const items=computed(()=>order.value.map(to=>catalog.find(item=>item.to===to)!).filter(Boolean))
  let snapshot:string[]=[]
  watch(storageKey,()=>{
    order.value=[...defaults];editing.value=false;snapshot=[];error.value=''
    try {
      const saved=JSON.parse(localStorage.getItem(storageKey.value)||'null')
      if(Array.isArray(saved))order.value=[...new Set(saved.filter((to):to is string=>typeof to==='string'&&catalog.some(item=>item.to===to)))]
    } catch {error.value='저장된 바로가기를 불러오지 못했습니다.'}
  },{immediate:true})
  function begin(){if(!editing.value)snapshot=[...order.value];editing.value=true;error.value=''}
  function cancel(){order.value=[...snapshot];editing.value=false;error.value=''}
  function save(){
    try {localStorage.setItem(storageKey.value,JSON.stringify(order.value));editing.value=false;error.value='';return true}
    catch {error.value='바로가기 구성을 저장하지 못했습니다.';return false}
  }
  function toggle(to:string){
    if(!editing.value||!catalog.some(item=>item.to===to))return
    order.value=order.value.includes(to)?order.value.filter(item=>item!==to):[...order.value,to]
  }
  function move(to:string,delta:number){
    if(!editing.value)return
    const from=order.value.indexOf(to),next=from+delta
    if(from<0||next<0||next>=order.value.length)return
    const copy=[...order.value];copy.splice(from,1);copy.splice(next,0,to);order.value=copy
  }
  function drop(from:string,before:string){
    if(!editing.value||from===before||!order.value.includes(from)||!order.value.includes(before))return
    const copy=order.value.filter(to=>to!==from);copy.splice(copy.indexOf(before),0,from);order.value=copy
  }
  function reset(){order.value=[...defaults]}
  return {order,items,editing,requestEdit,error,begin,cancel,save,toggle,move,drop,reset}
})
