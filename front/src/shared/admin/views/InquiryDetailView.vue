<script setup lang="ts">
import { computed, inject, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { adminKey } from '../main'
import { adminApi } from '../services/admin-api'
const route=useRoute(), {state}=inject(adminKey)!
type Inquiry={id:number;title:string;content:string;customerName?:string;createdAt?:string;replyContent:string|null;repliedAt?:string}
const item=ref<Inquiry|null>(null),answer=ref(''),loading=ref(false),saving=ref(false),error=ref(''),message=ref('')
const id=computed(()=>String(route.params.inquiryId||''))
const listPath=computed(()=>state.profile?.role==='SUPER_ADMIN'?'/super/customers':state.profile?.role==='REGIONAL_ADMIN'?'/regional/customers':'/opinions')
let request=0,controller:AbortController|undefined
async function load(){
 controller?.abort();controller=new AbortController();const seq=++request
 item.value=null;answer.value='';error.value='';message.value='';loading.value=true
 try{const data=await adminApi<Inquiry>(`/inquiries/${encodeURIComponent(id.value)}`,{signal:controller.signal});if(seq===request){item.value=data;answer.value=data.replyContent||''}}
 catch(e){if(seq===request)error.value=e instanceof Error?e.message:'문의 조회 실패'}
 finally{if(seq===request)loading.value=false}
}
async function save(){
 if(!item.value||saving.value)return
 if(!answer.value.trim()){message.value='답변을 입력해 주세요.';return}
 const current=id.value,existing=item.value.replyContent!=null;saving.value=true;message.value=''
 try{await adminApi(`/inquiries/${encodeURIComponent(current)}/reply`,{method:existing?'PUT':'POST',body:JSON.stringify({content:answer.value.trim()})});if(id.value===current){await load();message.value=existing?'답변을 수정했습니다.':'답변을 등록했습니다.'}}
 catch(e){if(id.value===current)message.value=e instanceof Error?e.message:'답변 저장 실패'}finally{saving.value=false}
}
async function remove(){
 if(!item.value||item.value.replyContent==null||saving.value||!confirm('답변을 삭제할까요? 문의는 답변 대기 상태로 돌아갑니다.'))return
 const current=id.value;saving.value=true;message.value=''
 try{await adminApi(`/inquiries/${encodeURIComponent(current)}/reply`,{method:'DELETE'});if(id.value===current){await load();message.value='답변을 삭제했습니다.'}}
 catch(e){if(id.value===current)message.value=e instanceof Error?e.message:'답변 삭제 실패'}finally{saving.value=false}
}
watch(id,()=>void load(),{immediate:true})
onBeforeUnmount(()=>{request++;controller?.abort()})
</script>
<template>
 <main class="super-workspace review-inquiry-page">
  <router-link :to="{path:listPath,query:{tab:'opinions'}}">← 문의 목록</router-link>
  <section class="su-card">
   <h1>문의 상세</h1>
   <p v-if="loading" role="status">불러오는 중…</p><p v-if="error" role="alert">{{ error }}</p>
   <template v-if="item">
    <div class="review-inquiry-heading"><h2>{{ item.title }}</h2><span class="review-status" :data-status="item.replyContent!=null?'ANSWERED':'PENDING'">{{ item.replyContent!=null?'답변 완료':'답변 대기' }}</span></div>
    <p>{{ item.customerName }} <time>{{ item.createdAt?.replace('T',' ').slice(0,16) }}</time></p>
    <div class="review-inquiry-content">{{ item.content }}</div>
    <form class="review-editor" @submit.prevent="save"><label>관리자 답변<textarea v-model="answer" rows="8" required :disabled="saving" /></label><div class="review-actions"><button :disabled="saving">{{ saving?'처리 중…':item.replyContent!=null?'답변 수정':'답변 등록' }}</button><button v-if="item.replyContent!=null" type="button" class="routel-danger-action" :disabled="saving" @click="remove">답변 삭제</button></div></form>
   </template>
   <p v-if="message" role="status">{{ message }}</p>
  </section>
 </main>
</template>
