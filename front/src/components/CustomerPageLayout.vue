<script setup lang="ts">
import {computed} from 'vue'
import {RouterLink,useRoute} from 'vue-router'
import {useApp} from '../stores/app'
const route=useRoute(),app=useApp()
const groups=[
 {title:'About us',to:'/info/company',items:[['회사 소개','/info/company'],['비전·로드맵','/info/vision'],['앱 소개','/info/app-guide']]},
 {title:'지하차도 현황',to:'/c-map',items:[['지하차도 현황','/c-map']]},
 {title:'알림마당',to:'/c-notice',items:[['공지사항','/c-notice'],['FAQ','/info/faq']]},
 {title:'연계 사이트',to:'/info/its',items:[['ITS','/info/its'],['기상청','/info/kma'],['에스트래픽','/info/straffic']]},
 {title:'회원 서비스',to:'/login',items:[['로그인','/login'],['회원가입','/signup'],['비밀번호 찾기','/password-reset'],['아이디 찾기','/find-id']]},
]
const myPage=computed(()=>route.path.startsWith('/my-'))
const group=computed(()=>{
 if(['/info/company','/info/vision','/info/app-guide'].includes(route.path))return groups[0]!
 if(route.path.includes('map'))return groups[1]!
 if(['/c-notice','/info/faq'].includes(route.path))return groups[2]!
 if(['/info/its','/info/kma','/info/straffic'].includes(route.path))return groups[3]!
 if(['/login','/signup','/password-reset','/find-id','/c-auth'].includes(route.path))return groups[4]!
 return {title:'ROUTEL',to:'/',items:groups.slice(0,4).map(g=>[g.title,g.to])}
})
const active=(to:string)=>to.includes('?')?route.fullPath===to:route.path===to&&!route.query.tab
const current=computed(()=>myPage.value?({'/my-home':(app.account||app.memberPreview)?'내 정보':'알림 내역','/my-account':'계정 설정','/my-alerts':'알림 내역','/my-inquiries':'문의','/my-inquiry-new':'문의하기','/my-cars':'내 차량','/my-withdraw':'회원 탈퇴'}[route.path]||'마이페이지'):group.value.items.find(([,to])=>active(to!))?.[0]||'홈')
</script>
<template>
 <div class="customer-page-layout" :class="{'is-mypage':myPage,'is-home':route.path==='/'}">
  <nav class="customer-breadcrumb" aria-label="현재 위치"><RouterLink to="/">홈</RouterLink><template v-if="route.path!=='/'"><span aria-hidden="true">›</span><RouterLink :to="myPage?'/my-home':group.to">{{myPage?'마이페이지':group.title}}</RouterLink><span aria-hidden="true">›</span><span aria-current="page">{{current}}</span></template></nav>
  <aside v-if="!myPage&&route.path!=='/'" class="customer-section-sidebar" aria-label="페이지 메뉴"><RouterLink :to="group.to" class="section-sidebar-title">{{group.title}}</RouterLink><nav><RouterLink v-for="[label,to] in group.items" :key="to" :to="to!" :aria-current="active(to!)?'page':undefined">{{label}}</RouterLink></nav><div class="section-sidebar-bottom"><RouterLink v-if="app.account||app.memberPreview" to="/my-home">마이페이지</RouterLink><RouterLink to="/info/app-guide">앱 소개</RouterLink></div></aside>
  <div class="customer-page-body"><slot/></div>
 </div>
</template>
