<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref } from 'vue'
import { useRoute } from 'vue-router'
import { asPage, backend, downloadPdf, queryString } from '../services/backend'
import { displayDate } from '../utils/display-date'
import { ownsFacility } from '../services/facilityAccess'

type Transfer = { id:number; agency:string; documentType:string; createdAt:string; carNums:string[] }
const route=useRoute(), dialog=ref<HTMLDialogElement>(), facility=ref<Record<string,any>>(),
  cars=ref<string[]>([]), selected=ref<string[]>([]), memo=ref(''), history=ref<Transfer[]>([]),
  loading=ref(false), saving=ref(false), downloading=ref<number>(), error=ref(''), message=ref('')
let request:AbortController|undefined
const canCreate=computed(()=>ownsFacility(facility.value)&&Number(facility.value?.currentBlockEventId)>0&&selected.value.length>0)
async function loadHistory(id:string,signal?:AbortSignal) {
  const rows=asPage<Transfer>(await backend('/api/control/underpasses/'+id+'/transfers',{signal})).items
  if(!signal?.aborted)history.value=rows.filter(row=>row.agency==='FIRE'&&row.documentType==='REMAINING_VEHICLES')
}
async function open(row:Record<string,any>) {
  request?.abort()
  const id=String(row.underpassId||'')
  if(!/^\d+$/.test(id))return
  const current=new AbortController();request=current
  facility.value=undefined;cars.value=[];selected.value=[];history.value=[];memo.value='';error.value='';message.value=''
  loading.value=true
  await nextTick();dialog.value?.showModal()
  try {
    const [detail]=await Promise.all([
      backend<Record<string,any>>('/api/underpasses/'+id,{signal:current.signal}),
      loadHistory(id,current.signal),
    ])
    if(current.signal.aborted)return
    facility.value=detail
    const numbers=new Set<string>()
    let page=1,totalPages=1
    do {
      const rows=asPage<Record<string,any>>(await backend('/api/underpasses/transits'+queryString({underpassId:id,status:'REMAINING',page,size:100}),{signal:current.signal}))
      for(const item of rows.items) {
        if(String(item.underpassId)!==id||item.status!=='REMAINING')continue
        const number=String(item.displayCarNum||item.carNum||'').trim()
        if(number)numbers.add(number)
      }
      totalPages=rows.totalPages;page++
    } while(page<=totalPages)
    if(current.signal.aborted)return
    cars.value=[...numbers];selected.value=[...numbers]
  } catch(e) { if(!current.signal.aborted)error.value=(e as Error).message }
  finally { if(!current.signal.aborted)loading.value=false }
}
function close() { if(!saving.value){request?.abort();dialog.value?.close()} }
async function create() {
  if(!canCreate.value||saving.value)return
  saving.value=true;error.value='';message.value=''
  try {
    const id=String(facility.value!.id)
    const pdf=await backend<Blob>('/api/control/underpasses/'+id+'/fire-transfer',{
      method:'POST',pdf:true,body:{eventId:facility.value!.currentBlockEventId,carNums:[...selected.value],memo:memo.value.trim()},
    })
    downloadPdf(pdf,`소방이관-${facility.value!.name}.pdf`)
    message.value='소방 이관 문서를 저장하고 PDF를 내려받았습니다.'
    await loadHistory(id)
  } catch(e) { error.value=(e as Error).message }
  finally {saving.value=false}
}
async function download(row:Transfer) {
  if(downloading.value!=null)return
  downloading.value=row.id;error.value=''
  try {downloadPdf(await backend<Blob>(`/api/control/transfers/${row.id}/pdf`,{pdf:true}),`소방이관-${row.id}.pdf`)}
  catch(e){error.value=(e as Error).message}
  finally{downloading.value=undefined}
}
onBeforeUnmount(()=>request?.abort())
defineExpose({open})
</script>
<template>
  <dialog ref="dialog" class="remaining-transfer-dialog" :class="{'remaining-transfer-app':route.path.startsWith('/admin-app/')}" aria-label="잔류차량 소방 이관 PDF" @close="request?.abort()" @cancel="saving?$event.preventDefault():request?.abort()">
    <header><div><small>잔류차량 전달 문서</small><h2>소방 이관 PDF</h2></div><button type="button" :disabled="saving" @click="close">닫기</button></header>
    <p v-if="loading" role="status">시설과 잔류차량을 확인하고 있습니다.</p>
    <p v-if="error" class="transfer-error" role="alert">{{error}}</p>
    <p v-if="message" role="status">{{message}}</p>
    <form v-if="facility&&!loading" @submit.prevent="create">
      <h3>{{facility.name}}</h3>
      <p>전달할 잔류차량을 선택하면 소방 이관 기록과 PDF를 생성합니다.</p>
      <p v-if="!facility.currentBlockEventId">현재 통제 이벤트가 없어 새 문서를 생성할 수 없습니다. 기존 문서는 아래에서 내려받으세요.</p>
      <fieldset><legend>잔류차량 {{cars.length}}대 · 선택 {{selected.length}}대</legend>
        <label v-for="car in cars" :key="car"><input v-model="selected" type="checkbox" :value="car" :disabled="saving" />{{car}}</label>
        <p v-if="!cars.length">현재 잔류차량이 없습니다.</p>
      </fieldset>
      <label class="transfer-memo">전달 내용<textarea v-model="memo" rows="3" :disabled="saving" /></label>
      <button class="transfer-create" type="submit" :disabled="loading||saving||!canCreate">{{saving?'PDF 생성 중…':'소방 이관 문서 생성·PDF 받기'}}</button>
    </form>
    <section v-if="!loading" class="transfer-history"><h3>기존 소방 이관 문서</h3>
      <p v-if="!history.length">저장된 잔류차량 소방 이관 문서가 없습니다.</p>
      <article v-for="item in history" :key="item.id"><div><strong>{{displayDate(item.createdAt)}}</strong><p>{{item.carNums?.join(', ')||'차량 번호 없음'}}</p></div><button type="button" :disabled="downloading!=null||saving" @click="download(item)">{{downloading===item.id?'받는 중…':'PDF 받기'}}</button></article>
    </section>
  </dialog>
</template>
<style scoped>
.remaining-transfer-dialog{box-sizing:border-box;width:min(600px,calc(100vw - 32px));max-height:calc(100dvh - 32px);padding:24px;overflow:auto;color:var(--r-ink);background:var(--r-surface);border:1px solid var(--r-line);border-radius:16px}
.remaining-transfer-app{max-width:406px}
header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;border-bottom:1px solid var(--r-line);padding-bottom:16px}small{color:var(--r-muted)}h2{margin:6px 0 0;font-size:22px}h3{font-size:16px;margin:20px 0 12px}p{font-size:13px;line-height:1.7;overflow-wrap:anywhere}button{min-height:42px;padding:9px 14px;border:1px solid var(--r-line);border-radius:8px;color:var(--r-ink);background:var(--r-surface);font:inherit;cursor:pointer;flex-shrink:0}button:disabled{opacity:.5;cursor:default}fieldset{display:flex;flex-wrap:wrap;gap:12px;margin:16px 0;padding:16px;border:1px solid var(--r-line);border-radius:10px}legend{font-size:13px}fieldset label{display:flex;align-items:center;gap:6px;font-size:14px}fieldset input{width:18px;height:18px}.transfer-memo{display:grid;gap:8px;font-size:13px}textarea{box-sizing:border-box;width:100%;padding:10px;border:1px solid var(--r-line);border-radius:8px;color:var(--r-ink);background:var(--r-surface);font:inherit;resize:vertical}.transfer-create{width:100%;margin-top:16px;background:var(--r-primary);color:var(--r-on-brand,#fff);border-color:transparent}.transfer-history{margin-top:24px;border-top:1px solid var(--r-line)}article{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 0;border-bottom:1px solid var(--r-line)}article>div{min-width:0}article strong{font-size:13px}article p{margin:6px 0 0;color:var(--r-muted)}.transfer-error{color:var(--danger,#b42318)}button:focus-visible,input:focus-visible,textarea:focus-visible{outline:2px solid var(--r-accent);outline-offset:2px}
@media(max-width:480px){.remaining-transfer-dialog{padding:20px}}
</style>
