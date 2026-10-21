<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { makeContext } from '../runtime/context'
import { enhance } from '../runtime/enhance'
import { initialize } from '../runtime/my-inquiries.js'
import '../styles/my-inquiries.css'
const root = ref<HTMLElement>()
const router = useRouter()
let dispose: (() => void) | undefined
let handlers: Record<string, (event: Event) => void> = {}
function handle(id: string, event: Event) {
  handlers[id]?.call(event.currentTarget, event)
}
onMounted(() => {
  if (!root.value) return
  const runtime = makeContext(root.value, router)
  dispose = runtime.dispose
  enhance('my-inquiries', runtime.ctx)
  handlers = initialize(runtime.ctx)
})
onBeforeUnmount(() => dispose?.())
</script>
<template>
  <div ref="root" class="wire-page page-my-inquiries">
    <header class="top">
      <div class="in">
        <a class="logo" href="#">ROUTEL</a>
        <nav aria-label="주 메뉴">
          <a href="#">통제현황</a>
          <a href="#">알림마당</a>
          <a href="#">앱</a>
          <a href="#">회사소개</a>
        </nav>
<div class="me">
          <a class="bell inl-7e3123f8ec" href="/my-alerts" aria-label="알림 3건">🔔<b>3</b>
          </a>
          <a class="btn sm" href="/my-home">김○○님</a>
        </div>
      </div>
    </header>

<div class="wrap">
      <aside class="side" aria-label="마이페이지 메뉴">
        <h2>마이페이지</h2>
        <a href="/my-home">내 정보</a>
        <a href="/my-account">계정 설정</a>
        <a href="/my-cars">내 차량</a>
        <a href="/my-alerts">알림 내역<span class="n">3</span>
        </a>
        <a href="/my-inquiries" aria-current="page">내 문의<span class="n">1</span>
        </a>
        <a href="/my-withdraw" class="dim">회원 탈퇴</a>
      </aside>
      <main class="main">
        <h1>내 문의</h1>
        <p class="lead">궁금한 점이나 불편한 점을 남기면 관리자가 답변해 드려요. 간단한 질문은 우측 하단 챗봇에게 먼저 물어볼 수도 있어요.</p>
<div class="row inl-eafa6bdd34">
          <a class="btn primary" href="/my-inquiry-new">+ 문의하기</a>
        </div>
<div class="card inl-4135303dac">
          <div class="item inl-06c8b5ed41">
            <div class="row inl-fe1dde3ba4">
              <button type="button" class="link tg" data-i="0" aria-expanded="false">알림이 오지 않아요</button>
              <span class="stat new">답변 대기</span>
            </div>
            <span class="m">10-12 · 분류 알림</span>
            <div id="d0" hidden class="inl-0466783d98">
              <div class="card inl-e30ad55ecf">위험 알림을 켰는데 어제부터 푸시가 안 와요.</div>
              <div class="hint inl-8a77e5a311">아직 답변이 등록되지 않았어요.</div>
            </div>
          </div>
          <div class="item inl-06c8b5ed41">
            <div class="row inl-fe1dde3ba4">
              <button type="button" class="link tg" data-i="1" aria-expanded="false">번호판 등록 오류</button>
              <span class="stat done">답변 완료</span>
            </div>
            <span class="m">10-05 · 분류 번호판</span>
            <div id="d1" hidden class="inl-0466783d98">
              <div class="card inl-e30ad55ecf">등록 버튼을 누르면 오류가 나요.</div>
              <div class="ans">
                <strong>답변</strong>
                <br />안녕하세요. 번호판 형식을 확인했더니 공백이 누락돼 있었어요. 현재는 정상 등록되도록 수정했습니다. 다시 시도해 주세요.</div>
            </div>
          </div>
          <div class="item inl-06c8b5ed41">
            <div class="row inl-fe1dde3ba4">
              <button type="button" class="link tg" data-i="2" aria-expanded="false">앱 로그인 문제</button>
              <span class="stat done">답변 완료</span>
            </div>
            <span class="m">09-28 · 분류 계정</span>
            <div id="d2" hidden class="inl-0466783d98">
              <div class="card inl-e30ad55ecf">앱에서 로그인이 안 돼요.</div>
              <div class="ans">
                <strong>답변</strong>
                <br />비밀번호 재설정 메일을 발송했어요. 확인 부탁드립니다.</div>
            </div>
          </div>
        </div>
      </main>
    </div>

<footer class="foot">
      <div class="in">
        <a href="#">회사소개</a>
        <a href="#">연계사이트</a>
        <a href="#">이용약관</a>
        <a href="#">개인정보처리방침</a>
      </div>
    </footer>

<button type="button" class="bot-fab" id="bot-fab" aria-expanded="false" aria-controls="bot">챗봇 문의</button>

<section class="bot" id="bot" hidden aria-label="챗봇">
      <div class="h">
        <strong>챗봇</strong>
        <button type="button" id="bot-x">닫기</button>
      </div>
      <div class="b"><div class="bb">안녕하세요! 궁금한 점을 물어보세요.</div></div>
      <div class="f">
        <input placeholder="질문을 입력하세요" aria-label="질문" />
        <button type="button" class="btn sm primary">보내기</button>
      </div>
    </section>

<div id="toast" class="toast" hidden role="status"></div>
  </div>
</template>
