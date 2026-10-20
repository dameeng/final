<script setup lang="ts">
import {ref,onMounted,onBeforeUnmount} from 'vue'
import {useRouter} from 'vue-router'
import {makeContext} from '../runtime/context'
import {enhance} from '../runtime/enhance'
import {initialize} from '../runtime/my-withdraw.js'
import '../styles/my-withdraw.css'
const root=ref<HTMLElement>();const router=useRouter();let dispose:(()=>void)|undefined;let handlers:Record<string,(event:Event)=>void>={}
function handle(id:string,event:Event){handlers[id]?.call(event.currentTarget,event)}
onMounted(()=>{if(!root.value)return;const runtime=makeContext(root.value,router);dispose=runtime.dispose;enhance('my-withdraw',runtime.ctx);handlers=initialize(runtime.ctx)})
onBeforeUnmount(()=>dispose?.())
</script>
<template><div ref="root" class="wire-page page-my-withdraw">
<header class="top"><div class="in"><a class="logo" href="#">ROUTEL</a><nav aria-label="주 메뉴"><a href="#">통제현황</a><a href="#">알림마당</a><a href="#">앱</a><a href="#">회사소개</a></nav>
<div class="me"><a class="bell inl-7e3123f8ec" href="/my-alerts" aria-label="알림 3건">🔔<b>3</b></a><a class="btn sm" href="/my-home">김○○님</a></div></div></header>

<div class="wrap"><aside class="side" aria-label="마이페이지 메뉴"><h2>마이페이지</h2><a href="/my-home">내 정보</a><a href="/my-account">계정 설정</a><a href="/my-cars">내 차량</a><a href="/my-alerts">알림 내역<span class="n">3</span></a><a href="/my-inquiries">내 문의<span class="n">1</span></a><a href="/my-withdraw" aria-current="page" class="dim">회원 탈퇴</a></aside><main class="main"><h1>회원 탈퇴</h1>
<div class="warnbox inl-87c136dfd0"><strong>탈퇴 전에 확인해 주세요</strong><ul class="inl-9c4c6b56c6"><li>등록한 차량 정보와 알림 내역이 삭제돼요.</li><li>작성한 문의와 답변은 삭제돼요.</li><li>탈퇴 후에는 복구할 수 없어요.</li></ul></div>
<div class="card"><div class="form"><label class="inl-01ef7fc99e"><input type="checkbox" id="ag" /> 위 내용을 확인했어요</label>
<div class="field"><label for="pw">비밀번호 확인</label><PasswordInput id="pw" /><span class="hint">서버에서 비밀번호를 한 번 더 확인한 뒤 탈퇴 처리해요</span></div>
<div class="row"><button type="button" class="btn danger" id="go" disabled>탈퇴하기</button><a class="btn" href="/my-home">취소</a></div></div></div>
<dialog id="dg" aria-labelledby="dg-t"><div class="dlg-h"><h2 id="dg-t">정말 탈퇴할까요?</h2></div><div class="dlg-b"><p class="inl-1169661891">탈퇴하면 모든 정보가 삭제되고 되돌릴 수 없어요.</p></div><div class="dlg-f"><button type="button" class="btn" data-close="dg">취소</button><button type="button" class="btn danger" id="dg-ok">탈퇴</button></div></dialog></main></div>

<footer class="foot"><div class="in"><a href="#">회사소개</a><a href="#">연계사이트</a><a href="#">이용약관</a><a href="#">개인정보처리방침</a></div></footer>

<button type="button" class="bot-fab" id="bot-fab" aria-expanded="false" aria-controls="bot">챗봇 문의</button>

<section class="bot" id="bot" hidden aria-label="챗봇"><div class="h"><strong>챗봇</strong><button type="button" id="bot-x">닫기</button></div><div class="b"><div class="bb">안녕하세요! 궁금한 점을 물어보세요.</div></div><div class="f"><input placeholder="질문을 입력하세요" aria-label="질문" /><button type="button" class="btn sm primary">보내기</button></div></section>

<div id="toast" class="toast" hidden role="status"></div>

</div></template>
