<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { makeContext } from '../runtime/context'
import { enhance } from '../runtime/enhance'
import { initialize } from '../runtime/my-home.js'
import '../styles/my-home.css'
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
  enhance('my-home', runtime.ctx)
  handlers = initialize(runtime.ctx)
})
onBeforeUnmount(() => dispose?.())
</script>
<template>
  <div ref="root" class="wire-page page-my-home">
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
        <a href="/my-home" aria-current="page">내 정보</a>
        <a href="/my-account">계정 설정</a>
        <a href="/my-cars">내 차량</a>
        <a href="/my-alerts">알림 내역<span class="n">3</span>
        </a>
        <a href="/my-inquiries">내 문의<span class="n">1</span>
        </a>
        <a href="/my-withdraw" class="dim">회원 탈퇴</a>
      </aside>
      <main class="main">
        <h1>내 정보</h1>
<div class="card">
          <div class="row inl-a562f4fd76">
            <div>
              <strong class="inl-b9199e22b2">김○○</strong>
              <div class="sub">kim***@example.com · 가입일 2026-09-02</div>
            </div>
            <a class="btn" href="/my-account">계정 설정</a>
          </div>
        </div>
<div class="sum inl-87c136dfd0">
          <a href="/my-cars">
            <small>등록 차량</small>
            <strong>2대</strong>
          </a>
          <a href="/my-alerts">
            <small>안 읽은 알림</small>
            <strong>3건</strong>
          </a>
          <a href="/my-inquiries">
            <small>답변 기다리는 문의</small>
            <strong>1건</strong>
          </a>
        </div>
<div class="grid2">
          <section class="card">
            <h2>최근 알림</h2>
<div class="item unread">
              <div>
                <span class="t">[위험] 초량1지하차도 침수 위험 단계</span>
                <span class="m">10-12 09:41</span>
              </div>
            </div>
<div class="item unread">
              <div>
                <span class="t">[공지] 시스템 점검 안내</span>
                <span class="m">10-11 18:00</span>
              </div>
            </div>
<div class="item">
              <div>
                <span class="t">[문의] 답변이 등록됐어요</span>
                <span class="m">10-10 14:20</span>
              </div>
            </div>
<a class="link" href="/my-alerts">알림 내역 전체 보기 →</a>
          </section>
<section class="card">
            <h2>최근 문의</h2>
<div class="item">
              <div>
                <span class="t">알림이 오지 않아요</span>
                <span class="m">10-12 · 분류 알림</span>
              </div>
              <span class="stat new">답변 대기</span>
            </div>
<div class="item">
              <div>
                <span class="t">번호판 등록 오류</span>
                <span class="m">10-05 · 분류 번호판</span>
              </div>
              <span class="stat done">답변 완료</span>
            </div>
<a class="link" href="/my-inquiries">내 문의 전체 보기 →</a>
          </section>
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
