<script setup lang="ts">
import {computed,inject} from 'vue'
import {useRoute} from 'vue-router'
import {adminKey} from '../main'
const route=useRoute(),{state}=inject(adminKey)!
const links=computed(()=>{
 const p=route.path,base=state.profile?.role==='SUPER_ADMIN'?'/super':'/regional'
 const result=[{label:'홈',to:'/dashboard'}]
 if(p==='/dashboard')return [...result,{label:'종합 현황',to:p}]
 if(p.includes('facilities')){result.push({label:'지하차도 관리',to:base+'/facilities'});if(route.params.id)result.push({label:state.underpasses.find(f=>f.id===String(route.params.id))?.name||'시설 상세',to:p});const names:Record<string,string>={overview:'개요',live:'실시간 관제',cameras:'카메라 설정',thresholds:'임계치',logs:'로그',operations:'차량·전광판',settings:'설정'};if(route.query.tab)result.push({label:names[String(route.query.tab)]||'시설 관리',to:route.fullPath})}
 else if(p.includes('customers')){result.push({label:'고객·게시물',to:base+'/customers'});const names:Record<string,string>={members:'고객 조회',opinions:'문의 처리',notices:'공지사항',faq:'FAQ'};if(route.query.tab)result.push({label:names[String(route.query.tab)]||'게시물',to:route.fullPath})}
 else result.push({label:({'/profile':'내 정보','/alert-evidence':'번호판 판별 대기','/cctv':'CCTV','/operations':'차량·전광판'} as Record<string,string>)[p]||(p.includes('logs')?'통합 로그':p.includes('accounts')?'지역·관리자':'관리자 업무'),to:route.fullPath})
 return result
})
</script>
<template><nav class="admin-breadcrumb" aria-label="현재 위치"><template v-for="(item,i) in links" :key="i"><span v-if="i" aria-hidden="true">/</span><router-link v-if="i<links.length-1" :to="item.to">{{ item.label }}</router-link><span v-else aria-current="page">{{ item.label }}</span></template></nav></template>
