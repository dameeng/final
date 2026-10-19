<script setup lang="ts">
import {ref,onBeforeUnmount} from 'vue'
import {loadPostcode,type PostalAddress} from '../services/postcode'
defineProps<{disabled?:boolean}>()
const emit=defineEmits<{select:[address:PostalAddress]}>(),dialog=ref<HTMLDialogElement>(),host=ref<HTMLElement>(),loading=ref(false),error=ref('')
let alive=true,request=0,trigger:HTMLElement|null=null
function close(){request++;dialog.value?.close();host.value?.replaceChildren();loading.value=false;trigger?.focus()}
async function open(event:MouseEvent){
 trigger=event.currentTarget as HTMLElement;error.value='';loading.value=true;const ticket=++request;dialog.value?.showModal()
 try{const Postcode=await loadPostcode();if(!alive||ticket!==request||!host.value)return;new Postcode({width:'100%',height:'100%',oncomplete:(data:any)=>{
  if(!alive||ticket!==request)return;const address=String(data.roadAddress||data.autoRoadAddress||data.jibunAddress||data.address||'');if(!address){error.value='주소를 선택해 주세요.';return}
  close();emit('select',{zipcode:String(data.zonecode||''),roadAddress:address});
  queueMicrotask(()=>trigger?.closest('form')?.querySelector<HTMLInputElement>('input[autocomplete="address-line2"]')?.focus())
 }}).embed(host.value);loading.value=false}catch(e){if(alive&&ticket===request){error.value=(e as Error).message;loading.value=false}}
}
onBeforeUnmount(()=>{alive=false;close()})
</script>
<template><span class="postcode-search-control"><button type="button" class="postcode-search-button" :disabled="disabled" @click="open">우편번호 찾기</button></span><Teleport to="body"><dialog ref="dialog" class="postcode-search-dialog" aria-label="우편번호·주소 검색" @cancel.prevent="close" @click="($event.target===dialog)&&close()"><header><h2>우편번호·주소 검색</h2><button type="button" @click="close">닫기</button></header><p v-if="loading" role="status">주소 검색을 불러오는 중입니다.</p><p v-if="error" role="alert">{{error}}</p><div ref="host" class="postcode-search-host"></div></dialog></Teleport></template>
<style scoped>.postcode-search-control{display:block;margin-top:8px}.postcode-search-button{padding:10px 14px;min-height:42px;border:1px solid var(--line,#c9ced6);border-radius:6px;background:var(--surface,#fff);color:var(--foreground,#20252b);font:inherit;white-space:nowrap;cursor:pointer}.postcode-search-dialog{position:fixed;inset:0;margin:auto;width:min(520px,calc(100vw - 24px));max-width:none;height:min(640px,calc(100dvh - 24px));max-height:calc(100dvh - 24px);padding:0;border:1px solid var(--line,#c9ced6);border-radius:10px;background:var(--surface,#fff);color:var(--foreground,#20252b);overflow:hidden}.postcode-search-dialog::backdrop{background:#172a4066}.postcode-search-dialog[open]{display:flex;flex-direction:column}.postcode-search-dialog header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 16px;flex-shrink:0;border-bottom:1px solid var(--line,#c9ced6)}h2{font-size:16px;margin:0}header button{padding:8px 12px;background:var(--surface,#fff);color:inherit;border:1px solid var(--line,#c9ced6);cursor:pointer}p{margin:12px 16px;font-size:14px}.postcode-search-host{flex:1;min-height:0;width:100%;background:#fff}</style>
