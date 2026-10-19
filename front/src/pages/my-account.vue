<script setup lang="ts">
import {ref,onMounted,onBeforeUnmount} from 'vue'
import {useRouter} from 'vue-router'
import {makeContext} from '../runtime/context'
import {enhance} from '../runtime/enhance'
import {initialize} from '../runtime/my-account.js'
import '../styles/my-account.css'
const root=ref<HTMLElement>();const router=useRouter();let dispose:(()=>void)|undefined;let handlers:Record<string,(event:Event)=>void>={}
function handle(id:string,event:Event){handlers[id]?.call(event.currentTarget,event)}
onMounted(()=>{if(!root.value)return;const runtime=makeContext(root.value,router);dispose=runtime.dispose;enhance('my-account',runtime.ctx);handlers=initialize(runtime.ctx)})
onBeforeUnmount(()=>dispose?.())
</script>
<template><div ref="root" class="wire-page page-my-account">
<header class="top"><div class="in"><a class="logo" href="#">ROUTEL</a><nav aria-label="주 메뉴"><a href="#">통제현황</a><a href="#">알림마당</a><a href="#">앱</a><a href="#">회사소개</a></nav>
<div class="me"><a class="bell inl-7e3123f8ec" href="/my-alerts" aria-label="알림 3건">🔔<b>3</b></a><a class="btn sm" href="/my-home">김○○님</a></div></div></header>

<div class="wrap"><aside class="side" aria-label="마이페이지 메뉴"><h2>마이페이지</h2><a href="/my-home">내 정보</a><a href="/my-account" aria-current="page">계정 설정</a><a href="/my-cars">내 차량</a><a href="/my-alerts">알림 내역<span class="n">3</span></a><a href="/my-inquiries">내 문의<span class="n">1</span></a><a href="/my-withdraw" class="dim">회원 탈퇴</a></aside><main class="main"><h1>계정 설정</h1>
<nav class="tabs" aria-label="계정 설정 탭"><a href="#info" id="t-info" aria-current="page">회원정보</a><a href="#pw" id="t-pw">비밀번호</a><a href="#push" id="t-push">알림 설정</a></nav>
<section class="card" id="s-info"><h2>회원정보</h2><div class="form">
<div class="field"><label for="f-id">아이디</label><input id="f-id" value="kim_minsu" disabled /></div>
<div class="field"><label for="f-name">이름</label><input id="f-name" value="김민수" /></div>
<div class="field"><label for="f-mail">이메일 (선택)</label><div class="row inl-2aca6dadb8"><input id="f-mail" value="kim@example.com" /><button type="button" class="btn">중복 확인</button></div></div>
<div class="field"><label for="f-bd">생년월일</label><input id="f-bd" value="1990.01.01" disabled /></div>
<div class="field"><label for="f-tel">휴대폰 번호</label><div class="row inl-2aca6dadb8"><input id="f-tel" value="010-1234-5678" /><button type="button" class="btn">번호 변경 · 인증</button></div><span class="hint">번호를 바꾸면 인증번호(문자)로 본인 확인을 해요</span></div>
<div class="field"><label for="f-em">비상 연락처 (선택)</label><input id="f-em" value="010-9876-5432" /></div>
<div class="field"><label for="f-addr">주소 (선택)</label><div class="row inl-2aca6dadb8"><input id="f-addr" value="부산광역시 해운대구 ○○로 12" /><button type="button" class="btn">주소 검색</button></div></div>
<div class="row"><button type="button" class="btn primary" data-save="회원정보를 저장했어요">저장</button><button type="button" class="btn">취소</button></div></div></section>
<section class="card" id="s-pw" hidden><h2>비밀번호 변경</h2><div class="form">
<div class="field"><label for="p0">현재 비밀번호</label><input id="p0" type="password" /></div>
<div class="field"><label for="p1">새 비밀번호</label><input id="p1" type="password" /><span class="hint">영문, 숫자, 특수문자 포함 8자 이상</span></div>
<div class="field"><label for="p2">새 비밀번호 확인</label><input id="p2" type="password" /></div>
<div class="row"><button type="button" class="btn primary" data-save="비밀번호를 변경했어요">변경</button></div></div></section>
<section class="card" id="s-push" hidden><h2>알림 설정</h2><p class="hint inl-d462248a40">앱 푸시 수신 설정이에요. 알림 내역 화면에서도 같은 설정을 바꿀 수 있어요.</p>
<label class="sw"><span><strong>푸시 알림 받기</strong><small>끄면 아래 알림도 모두 오지 않아요</small></span><input type="checkbox" id="m" checked /></label>
<label class="sw"><span><strong>위험 알림</strong><small>등록 차량 경로의 지하차도가 주의·위험일 때</small></span><input type="checkbox" class="sub-sw" checked /></label>
<label class="sw"><span><strong>공지 알림</strong><small>점검·업데이트·긴급 공지</small></span><input type="checkbox" class="sub-sw" checked /></label>
<label class="sw"><span><strong>문의 답변 알림</strong><small>내 문의에 답변이 등록됐을 때</small></span><input type="checkbox" class="sub-sw" checked /></label></section></main></div>

<footer class="foot"><div class="in"><a href="#">회사소개</a><a href="#">연계사이트</a><a href="#">이용약관</a><a href="#">개인정보처리방침</a></div></footer>

<button type="button" class="bot-fab" id="bot-fab" aria-expanded="false" aria-controls="bot">챗봇 문의</button>

<section class="bot" id="bot" hidden aria-label="챗봇"><div class="h"><strong>챗봇</strong><button type="button" id="bot-x">닫기</button></div><div class="b"><div class="bb">안녕하세요! 궁금한 점을 물어보세요.</div></div><div class="f"><input placeholder="질문을 입력하세요" aria-label="질문" /><button type="button" class="btn sm primary">보내기</button></div></section>

<div id="toast" class="toast" hidden role="status"></div>

</div></template>
