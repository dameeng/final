<script setup lang="ts">
import {onBeforeUnmount,reactive,watch} from 'vue'
import {boardCategoryLabel} from '../services/backendCatalog'
import {backend} from '../services/backend'
type Item=Record<string,any>
const props=defineProps<{items:Item[];manage?:boolean;initialOpenId?:string;saving?:boolean}>()
defineEmits<{edit:[row:Item];remove:[row:Item];move:[row:Item,direction:number]}>()
const answers=reactive<Record<string,{loading:boolean;answer?:string;error:string}>>({})
const requests=new Map<string,AbortController>()
async function load(row:Item){
 const id=String(row.id)
 if(answers[id]?.loading||answers[id]?.answer!==undefined)return
 answers[id]={loading:true,error:''}
 const controller=new AbortController();requests.set(id,controller)
 try{const detail=await backend(`/api/faqs/${encodeURIComponent(id)}`,{signal:controller.signal});if(!controller.signal.aborted){answers[id]={loading:false,answer:String(detail?.answer??''),error:''};if(typeof detail?.viewCount==='number')row.viewCount=detail.viewCount}}
 catch(e){if(!controller.signal.aborted)answers[id]={loading:false,error:(e as Error).message}}
 finally{requests.delete(id)}
}
function toggle(row:Item,event:Event){if((event.target as HTMLDetailsElement).open)void load(row)}
watch(()=>props.items,items=>{const loaded=Object.keys(answers);requests.forEach(controller=>controller.abort());requests.clear();for(const id of loaded)delete answers[id];for(const row of items)if(loaded.includes(String(row.id)))void load(row)})
onBeforeUnmount(()=>requests.forEach(controller=>controller.abort()))
</script>
<template><div class="faq-accordion"><details v-for="(row,index) in items" :key="row.id" class="faq-accordion-item" :open="String(row.id)===initialOpenId||undefined" @toggle="toggle(row,$event)"><summary><span class="faq-question-mark" aria-hidden="true">Q</span><strong>{{row.question}}</strong><svg class="faq-expand-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></summary><div class="faq-inline-answer"><span class="faq-answer-mark" aria-hidden="true">A</span><div class="faq-answer-content"><p v-if="row.category||row.viewCount!=null" class="sub">{{row.categoryLabel||boardCategoryLabel(row.category)}} · 조회 {{row.viewCount??0}}회</p><p v-if="answers[String(row.id)]?.loading" role="status">답변을 불러오는 중입니다.</p><template v-else-if="answers[String(row.id)]?.error"><p role="alert">{{answers[String(row.id)]?.error}}</p><button type="button" @click="load(row)">다시 불러오기</button></template><p v-else class="faq-answer-text">{{answers[String(row.id)]?.answer||'등록된 답변이 없습니다.'}}</p><div v-if="manage" class="service-actions"><button type="button" @click="$emit('edit',row)">수정</button><button type="button" @click="$emit('remove',row)">삭제</button><button type="button" :disabled="saving||index===0" @click="$emit('move',row,-1)">위로</button><button type="button" :disabled="saving||index===items.length-1" @click="$emit('move',row,1)">아래로</button></div></div></div></details><p v-if="!items.length" class="faq-empty">조회된 질문이 없습니다.</p></div></template>
<style scoped>
.faq-accordion{border:1px solid var(--line,#c9ced6);border-radius:10px;overflow:hidden;background:var(--surface,#fff)}
.faq-accordion-item+.faq-accordion-item{border-top:1px solid var(--line,#c9ced6)}
.faq-accordion-item summary{display:flex;align-items:center;gap:14px;padding:20px;cursor:pointer;list-style:none;min-height:68px}
.faq-accordion-item summary::-webkit-details-marker{display:none}
.faq-accordion-item summary:focus-visible{outline:2px solid #225f9b;outline-offset:-3px}
.faq-accordion-item summary strong{flex:1;min-width:0;font-size:16px;font-weight:600;line-height:1.6;overflow-wrap:anywhere}
.faq-question-mark,.faq-answer-mark{flex-shrink:0;font-size:17px;font-weight:700;color:#225f9b;line-height:24px}
.faq-expand-icon{flex-shrink:0;color:var(--ink-sub,#64748b);transition:transform .15s}
.faq-accordion-item[open] .faq-expand-icon{transform:rotate(180deg)}
.faq-accordion-item[open] summary{background:var(--soft,#f3f6fa)}
.faq-inline-answer{display:flex;gap:14px;padding:22px 24px 22px 48px;background:var(--soft,#f3f6fa);color:var(--foreground,#27384a);border-top:1px solid var(--line,#c9ced6)}
.faq-answer-content{min-width:0;flex:1}
.faq-answer-content p{margin:0;font-size:15px;line-height:1.8;overflow-wrap:anywhere}
.faq-answer-text{white-space:pre-wrap}
.faq-answer-content .service-actions{margin-top:16px}
.faq-empty{padding:24px;text-align:center;color:var(--ink-sub,#64748b)}
@media(max-width:600px){.faq-accordion-item summary{padding:16px 12px;gap:10px}.faq-inline-answer{padding:18px 14px 18px 30px;gap:10px}}
@media(prefers-reduced-motion:reduce){.faq-expand-icon{transition:none}}
</style>
