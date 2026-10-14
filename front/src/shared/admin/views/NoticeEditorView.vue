<script setup lang="ts">
import { computed, inject, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { adminKey } from '../main'
import { adminApi } from '../services/admin-api'
const route=useRoute(), router=useRouter(), {state}=inject(adminKey)!
const kind=computed(()=>route.query.kind==='FAQ'?'FAQ':'공지')
const title=ref(''), content=ref(''), important=ref(false), busy=ref(false), message=ref('')
const back=computed(()=>({path:state.profile?.role==='REGIONAL_ADMIN'?'/regional/customers':state.profile?.role==='SUPER_ADMIN'?'/super/customers':'/notices',query:{tab:state.profile?.role==='REGIONAL_ADMIN'&&kind.value==='FAQ'?'faq':'notices'}}))
async function save(){
 if(busy.value)return
 if(!title.value.trim()||!content.value.trim()){message.value='제목과 내용을 입력해 주세요.';return}
 busy.value=true;message.value=''
 try{await adminApi(kind.value==='FAQ'?'/faqs':'/notices',{method:'POST',body:JSON.stringify(kind.value==='FAQ'?{question:title.value.trim(),answer:content.value.trim()}:{title:title.value.trim(),content:content.value.trim(),important:important.value})});await router.push(back.value)}
 catch(e){message.value=e instanceof Error?e.message:'게시글 저장 실패'}finally{busy.value=false}
}
</script>
<template><div class="routel-admin-page qa-notice-editor"><router-link :to="back">목록으로</router-link><h1>{{ kind }} 등록</h1><form class="review-editor" @submit.prevent="save"><p><label>제목<input v-model="title" required maxlength="200" /></label></p><p><label>내용<textarea v-model="content" rows="14" required /></label></p><p v-if="kind==='공지'"><label><input v-model="important" type="checkbox" /> 중요 공지</label></p><div class="qa-log-links"><button type="submit" :disabled="busy">{{ busy?'저장 중…':'등록' }}</button><router-link :to="back">취소</router-link></div><p role="status">{{ message }}</p></form></div></template>
