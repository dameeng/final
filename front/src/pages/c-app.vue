<script setup lang="ts">
import {ref,onMounted,onBeforeUnmount} from 'vue'
import {useRouter} from 'vue-router'
import {makeContext} from '../runtime/context'
import {enhance} from '../runtime/enhance'
import {initialize} from '../runtime/c-app.js'
import '../styles/c-app.css'
const root=ref<HTMLElement>();const router=useRouter();let dispose:(()=>void)|undefined;let handlers:Record<string,(event:Event)=>void>={}
function handle(id:string,event:Event){handlers[id]?.call(event.currentTarget,event)}
onMounted(()=>{if(!root.value)return;const runtime=makeContext(root.value,router);dispose=runtime.dispose;enhance('c-app',runtime.ctx);handlers=initialize(runtime.ctx)})
onBeforeUnmount(()=>dispose?.())
</script>
<template><div ref="root" class="wire-page page-c-app">
<header class="top"><div class="in"><a class="logo" href="/c-map">ROUTEL</a><nav><a href="/c-app" class="on">About us</a><a href="/c-map" class="">지하차도 현황</a><a href="/c-notice" class="">알림마당</a><a href="#" class="">연계사이트</a></nav><a class="btn p" href="/info/app-download">⬇ 앱 다운로드</a><a class="btn" href="/c-auth">로그인</a><a class="btn" href="/c-auth">회원가입</a></div></header>
<div class="wrap"><h1>앱 소개</h1>



<section class="hero"><div><div class="inl-b2eeea370e"><div><h1 class="inl-c30b50c9dd">ROUTEL</h1><div class="sub">지하차도 침수 알림 · 통제 확인 · 우회 길 안내</div></div></div>
<p class="inl-3197165cb2">비 오는 날 가는 길의 지하차도가 통제 중인지 먼저 알려드려요.<br />위험 단계가 오르면 푸시로 알리고, 통제 구간을 피하는 길 안내와 위험도 예측까지 보여줘요.</p>
<div class="stores"><a class="btn k">▶ Google Play에서 받기</a><a class="btn k"> App Store에서 받기</a><a class="btn">홈 화면에 추가 (웹앱)</a></div></div>
</section>

<section class="inl-24d308c08b"><h2 class="inl-4c1af261d0">주요 기능</h2><div class="feat"><div class="panel"><b>위험 알림</b><span class="sub">위험·주의 단계 상승과 통제 시작·해제를 푸시로 알려요.</span></div><div class="panel"><b>통제현황 · 날씨</b><span class="sub">지도에서 지하차도별 단계와 통제 여부, 인근 날씨를 확인해요.</span></div><div class="panel"><b>길 안내 · 위험도 예측</b><span class="sub">가는 길의 지하차도 상태를 반영해 우회 경로를 안내하고, 위험도 예측을 그래프로 보여줘요.</span></div></div></section>
<section id="install" class="inl-24d308c08b"><h2 class="inl-4c1af261d0">설치 방법</h2><div class="how"><div class="panel"><h2>Android</h2><ol><li>Google Play에서 ROUTEL 검색 후 설치</li><li>앱을 열고 로그인 또는 회원가입</li><li>알림 권한을 허용</li></ol></div><div class="panel"><h2>iPhone</h2><ol><li>App Store에서 ROUTEL 검색 후 설치</li><li>앱을 열고 로그인 또는 회원가입</li><li>알림 권한을 허용</li></ol></div></div><div class="stores"><a class="btn">앱 사용설명서 보기</a><a class="btn">자주 묻는 질문</a></div></section></div>
<footer class="foot"><div class="in"><a href="#">회사소개</a><a href="#">연계사이트</a><a href="#">이용약관</a><a href="#">개인정보처리방침</a></div></footer>
</div></template>
