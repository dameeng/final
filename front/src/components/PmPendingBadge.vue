<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { useApp } from '../stores/app'
import { backend, asPage } from '../services/backend'
import { useBackendEvents } from '../composables/useBackendEvents'
const app=useApp(), count=ref<number|null>(null)
let request:AbortController|undefined,timer:ReturnType<typeof setTimeout>|undefined
async function load(){
  request?.abort();count.value=null
  if(app.account?.role!=='REGIONAL_ADMIN')return
  const current=new AbortController();request=current
  try{const result=asPage(await backend('/api/pm/events?page=1&size=1',{signal:current.signal}));if(!current.signal.aborted)count.value=result.totalItems}catch{}
}
watch(()=>[app.account?.id,app.account?.role],load,{immediate:true})
useBackendEvents(({name,data})=>{if(name==='connected'||name==='pm-update'||name==='data-changed'&&['pm-event','pm-action','pm-equipment'].includes(data.resource)){clearTimeout(timer);timer=setTimeout(()=>void load(),250)}})
onBeforeUnmount(()=>{request?.abort();clearTimeout(timer)})
</script>
<template><span v-if="count!==null&&count>0" class="pm-pending-badge" :aria-label="'점검 대기 '+count+'건'">{{count>99?'99+':count}}</span></template>
<style scoped>.pm-pending-badge { display:inline-flex; align-items:center; justify-content:center; min-width:20px; padding:2px 6px; margin-left:6px; border-radius:12px; background:var(--status-danger-bg,#fce5e9); color:var(--status-danger-ink,#a02e40); font-size:11px; font-weight:700; }</style>
