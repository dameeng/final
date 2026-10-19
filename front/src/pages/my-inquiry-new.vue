<script setup lang="ts">
import {ref,onMounted,onBeforeUnmount} from 'vue'
import {useRouter} from 'vue-router'
import {makeContext} from '../runtime/context'
import {enhance} from '../runtime/enhance'
import {initialize} from '../runtime/my-inquiry-new.js'
import '../styles/my-inquiry-new.css'
const root=ref<HTMLElement>();const router=useRouter();let dispose:(()=>void)|undefined;let handlers:Record<string,(event:Event)=>void>={}
function handle(id:string,event:Event){handlers[id]?.call(event.currentTarget,event)}
onMounted(()=>{if(!root.value)return;const runtime=makeContext(root.value,router);dispose=runtime.dispose;enhance('my-inquiry-new',runtime.ctx);handlers=initialize(runtime.ctx)})
onBeforeUnmount(()=>dispose?.())
</script>
<template><div ref="root" class="wire-page page-my-inquiry-new">
<header class="top"><div class="in"><a class="logo" href="#">ROUTEL</a><nav aria-label="주 메뉴"><a href="#">통제현황</a><a href="#">알림마당</a><a href="#">앱</a><a href="#">회사소개</a></nav>
<div class="me"><a class="bell inl-7e3123f8ec" href="/my-alerts" aria-label="알림 3건">🔔<b>3</b></a><a class="btn sm" href="/my-home">김○○님</a></div></div></header>

<div class="wrap"><aside class="side" aria-label="마이페이지 메뉴"><h2>마이페이지</h2><a href="/my-home">내 정보</a><a href="/my-account">계정 설정</a><a href="/my-cars">내 차량</a><a href="/my-alerts">알림 내역<span class="n">3</span></a><a href="/my-inquiries" aria-current="page">내 문의<span class="n">1</span></a><a href="/my-withdraw" class="dim">회원 탈퇴</a></aside><main class="main"><h1>문의하기</h1><p class="lead"><a class="link" href="/my-inquiries">← 내 문의</a></p>
<div class="card"><div class="form inl-b12974cb6c">
<div class="field"><label for="c">분류</label><select id="c"><option>알림</option><option>번호판·차량</option><option>계정</option><option>서비스 이용</option><option>기타</option></select></div>
<div class="field"><label for="t">제목</label><input id="t" placeholder="제목을 입력하세요" /></div>
<div class="field"><label for="b">내용</label><textarea id="b" placeholder="문의 내용을 자세히 적어 주세요" class="inl-b9666ec1f9"></textarea></div>
<p class="hint inl-1169661891">답변이 등록되면 알림으로 알려드려요. (알림 설정에서 끌 수 있어요)</p>
<div class="row"><button type="button" class="btn primary" id="ok">등록</button><a class="btn" href="/my-inquiries">취소</a></div></div></div></main></div>

<footer class="foot"><div class="in"><a href="#">회사소개</a><a href="#">연계사이트</a><a href="#">이용약관</a><a href="#">개인정보처리방침</a></div></footer>

<button type="button" class="bot-fab" id="bot-fab" aria-expanded="false" aria-controls="bot">챗봇 문의</button>

<section class="bot" id="bot" hidden aria-label="챗봇"><div class="h"><strong>챗봇</strong><button type="button" id="bot-x">닫기</button></div><div class="b"><div class="bb">안녕하세요! 궁금한 점을 물어보세요.</div></div><div class="f"><input placeholder="질문을 입력하세요" aria-label="질문" /><button type="button" class="btn sm primary">보내기</button></div></section>

<div id="toast" class="toast" hidden role="status"></div>

</div></template>
