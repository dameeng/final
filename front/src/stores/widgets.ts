import {defineStore} from 'pinia'
import {ref} from 'vue'
export interface WidgetLayout{id:string;x:number;y:number;w:number;h:number}
const ids=['map','summary','verify','todo','top5','health','events','shortcuts']
const clone=(items:WidgetLayout[])=>JSON.parse(JSON.stringify(items)) as WidgetLayout[]
export const useWidgets=defineStore('widgets',()=>{
 const saved=ref<WidgetLayout[]>([]),draft=ref<WidgetLayout[]>([]),editing=ref(false)
 function begin(){draft.value=clone(saved.value);editing.value=true}
 function cancel(){draft.value=[];editing.value=false}
 function load(key:string,defaults:WidgetLayout[]){
  editing.value=false
  try{
   const raw=JSON.parse(localStorage.getItem(key)||'null')
   if(raw?.version!==6||!Array.isArray(raw.items)){saved.value=clone(defaults);return}
   const seen=new Set<string>()
   const valid=raw.items.filter((w:WidgetLayout)=>{if(!w||!ids.includes(w.id)||seen.has(w.id)||![w.x,w.y,w.w,w.h].every(Number.isInteger)||w.x<0||w.y<0||w.w<(w.id==='map'||w.id==='summary'||w.id==='top5'?6:3)||w.h<(w.id==='summary'?1:w.id==='map'?5:w.id==='events'||w.id==='top5'||w.id==='todo'?3:2)||w.x+w.w>12)return false;seen.add(w.id);return true})
   saved.value=valid.length||raw.items.length===0?clone(valid):clone(defaults)
  }catch{saved.value=clone(defaults)}
 }
 function save(key:string){const next=clone(draft.value);localStorage.setItem(key,JSON.stringify({version:6,items:next}));saved.value=next;editing.value=false}
 return {saved,draft,editing,begin,cancel,load,save}
})
