<script setup lang="ts">
import {computed,ref} from 'vue'
import {RouterLink,useRoute} from 'vue-router'
import {useApp} from '../stores/app'
const app=useApp(),route=useRoute(),sent=ref(false)
const memberView=computed(()=>!!app.account||app.memberPreview)
const memberMenus=[['내 정보','/my-home'],['계정 설정','/my-account'],['내 차량','/my-cars'],['알림 내역','/my-alerts'],['내 문의','/my-inquiries'],['회원 탈퇴','/my-withdraw']]
const guestMenus=[['알림 내역','/my-alerts'],['문의','/my-inquiries']]
const menus=computed(()=>memberView.value?memberMenus:guestMenus)
const inquiry=computed(()=>route.path==='/my-inquiries'||route.path==='/my-inquiry-new')
const title=computed(()=>inquiry.value?'문의':'알림 내역')
const guestAlerts=computed(()=>app.notices.filter(n=>!n.start||Date.parse(n.start)<=Date.now()).filter(n=>!n.end||Date.parse(n.end)>=Date.now()))
</script>
<template>
 <div class="mypage-preview-controls" v-if="app.previewAvailable&&!app.account"><span>마이페이지 화면 확인</span><div><button type="button" :aria-pressed="!app.memberPreview" @click="app.setMemberPreview(false)">비회원 화면 보기</button><button type="button" :aria-pressed="app.memberPreview" @click="app.setMemberPreview(true)">회원 화면 보기</button></div><small>백엔드 연동 전 화면 확인용이며 실제 로그인은 아닙니다.</small></div>
 <div class="mypage-layout">
  <aside class="mypage-sidebar" aria-label="마이페이지 메뉴"><h2>마이페이지</h2><nav><RouterLink v-for="[label,to] in menus" :key="to" :to="to!" :aria-current="route.path===to||(!memberView&&route.path==='/my-home'&&to==='/my-alerts')?'page':undefined">{{label}}<span v-if="to==='/my-alerts'&&app.unread" class="mypage-count">{{app.unread}}</span></RouterLink></nav><p v-if="!memberView" class="mypage-guest-note">로그인하면 계정 설정과 내 차량을 관리할 수 있습니다.<RouterLink :to="{path:'/login',query:{next:'/my-home'}}">로그인 →</RouterLink></p></aside>
  <div class="mypage-body"><slot v-if="memberView"/>
   <main v-else class="guest-mypage"><h1>{{title}}</h1>
    <template v-if="!inquiry"><p class="mypage-description">비회원도 서비스 공지와 안전 안내를 확인할 수 있습니다.</p><section class="mypage-card"><div class="mypage-card-heading"><h2>서비스 알림</h2><button v-if="app.unread" @click="app.unread=0">모두 읽음</button></div><ul v-if="guestAlerts.length" class="guest-alerts"><li v-for="alert in guestAlerts" :key="alert.id"><strong>{{alert.title}}</strong><p>{{alert.body}}</p></li></ul><div v-else class="mypage-empty"><svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg><p>현재 표시할 서비스 알림이 없습니다.</p><RouterLink to="/c-notice">공지사항 확인 →</RouterLink></div></section></template>
    <template v-else><p class="mypage-description">서비스 이용 중 궁금한 점이나 불편한 점을 남겨 주세요.</p><section class="mypage-card"><div class="mypage-card-heading"><h2>문의하기</h2><RouterLink to="/info/faq">자주 묻는 질문 →</RouterLink></div><form class="guest-inquiry-form" @submit.prevent="sent=true"><label>이메일<input type="email" autocomplete="email" placeholder="답변 받을 이메일" required></label><label>문의 제목<input maxlength="100" required></label><label>문의 내용<textarea rows="6" maxlength="3000" required></textarea></label><button type="submit">문의 접수</button><p v-if="sent" role="status">문의 접수 서비스 연결 전입니다. 아직 전송되지 않았으며 입력 내용은 유지됩니다.</p></form></section></template>
   </main>
  </div>
 </div>
</template>
