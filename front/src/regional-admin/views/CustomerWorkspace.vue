<script setup lang="ts">
import {computed,inject,onBeforeUnmount,ref,watch} from 'vue'
import {useRoute} from 'vue-router'
import {adminKey} from '../../shared/admin/main'
import {adminApi} from '../../shared/admin/services/admin-api'
import RecordsView from '../../shared/admin/views/RecordsView.vue'
const {state}=inject(adminKey)!,route=useRoute()
const tabs=[['members','고객 조회'],['opinions','문의 처리'],['notices','공지사항'],['faq','FAQ']]
const active=computed(()=>tabs.some(t=>t[0]===route.query.tab)?String(route.query.tab):'members')
type Customer={id:number;loginId:string;name:string;email:string;phone:string;carNums:string[];createdAt:string}
const rows=ref<Customer[]>([]),query=ref(''),page=ref(1),pages=ref(1),loading=ref(false),error=ref(''),selected=ref<Customer|null>(null)
let controller:AbortController|undefined,version=0
async function load(){controller?.abort();const seq=++version;controller=new AbortController();loading.value=true;error.value='';selected.value=null
 try{const data=await adminApi<{items:Customer[];totalPages:number}>('/customers?'+new URLSearchParams({page:String(page.value),size:'10',keyword:query.value.trim()}),{signal:controller.signal});if(seq!==version)return;if(!Array.isArray(data?.items))throw new Error('고객 목록 응답 형식 확인 필요');rows.value=data.items;pages.value=Math.max(1,data.totalPages||1)}catch(e){if(seq===version){rows.value=[];error.value=e instanceof Error?e.message:'고객 조회 실패'}}finally{if(seq===version)loading.value=false}}
watch(active,a=>{controller?.abort();version++;rows.value=[];selected.value=null;page.value=1;if(a==='members')void load()},{immediate:true})
onBeforeUnmount(()=>{controller?.abort();version++})
</script>
<template><div v-if="state.profile?.role==='REGIONAL_ADMIN'" class="regional-workspace"><div class="su-heading"><h1>고객·게시물</h1><p>고객 조회, 문의 처리와 서비스 안내를 한곳에서 확인합니다.</p></div><nav class="su-tabs" aria-label="고객·게시물 업무"><router-link v-for="t in tabs" :key="t[0]" :to="{path:route.path,query:{tab:t[0]}}" :aria-current="active===t[0]?'page':undefined">{{ t[1] }}</router-link></nav>
<section v-if="active==='members'" class="su-card"><form class="su-filters" @submit.prevent="page=1;load()"><label class="su-search">고객 검색<input v-model="query" placeholder="이름·아이디·차량번호 검색"></label><button :disabled="loading">조회</button><button type="button" :disabled="loading" @click="query='';page=1;load()">초기화</button></form><p class="su-muted">민원 처리용 고객 조회 · 회원 수정·탈퇴 기능은 제공하지 않습니다.</p><p v-if="error" class="su-error" role="alert">{{ error }}</p><div class="su-table-wrap"><table><thead><tr><th>고객 번호</th><th>이름</th><th>연락처</th><th>차량</th><th>상세</th></tr></thead><tbody><tr v-for="r in rows" :key="r.id"><td>{{ r.id }}</td><td>{{ r.name }}</td><td>{{ r.phone||'정보 없음' }}</td><td>{{ (r.carNums||[]).join(', ')||'미등록' }}</td><td><button @click="selected=r">상세 보기</button></td></tr><tr v-if="!rows.length"><td colspan="5" class="su-empty">{{ loading?'조회 중':error?'조회 실패':'검색 결과가 없습니다.' }}</td></tr></tbody></table></div><nav class="su-pagination" aria-label="고객 목록 페이지"><button :disabled="loading||page===1" @click="page--;load()">이전</button><span>{{ page }} / {{ pages }}</span><button :disabled="loading||page>=pages" @click="page++;load()">다음</button></nav><section v-if="selected" class="rw-section"><div class="su-line"><h2>고객 #{{ selected.id }}</h2><button @click="selected=null">닫기</button></div><dl><dt>이름</dt><dd>{{ selected.name }}</dd><dt>이메일</dt><dd>{{ selected.email||'정보 없음' }}</dd><dt>연락처</dt><dd>{{ selected.phone||'정보 없음' }}</dd><dt>가입일</dt><dd>{{ selected.createdAt||'—' }}</dd></dl></section></section>
<section v-else class="su-card su-embedded"><RecordsView v-if="active==='opinions'" section="opinions"/><RecordsView v-else :key="active" section="notices" :board-kind="active==='faq'?'FAQ':'공지'"/></section>
</div></template>
