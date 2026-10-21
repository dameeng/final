<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { makeContext } from '../runtime/context'
import { enhance } from '../runtime/enhance'
import { initialize } from '../runtime/my-alerts.js'
import '../styles/my-alerts.css'
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
  enhance('my-alerts', runtime.ctx)
  handlers = initialize(runtime.ctx)
})
onBeforeUnmount(() => dispose?.())
</script>
<template>
  <div ref="root" class="wire-page page-my-alerts">
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
        <a href="/my-alerts" aria-current="page">알림 내역<span class="n">3</span>
        </a>
        <a href="/my-inquiries">내 문의<span class="n">1</span>
        </a>
        <a href="/my-withdraw" class="dim">회원 탈퇴</a>
      </aside>
      <main class="main">
        <h1>알림 내역</h1>
<div class="card">
          <label class="sw inl-fd8f71c4e6">
            <span>
              <strong>푸시 알림 받기</strong>
              <small>계정 설정 &gt; 알림 설정과 같은 설정이에요</small>
            </span>
            <input type="checkbox" id="m" checked />
          </label>
        </div>
<div class="row inl-709781a554">
          <div class="chips" id="chips">
            <button type="button" class="chip" aria-pressed="true" data-c="">전체</button>
            <button type="button" class="chip" aria-pressed="false" data-c="위험">위험</button>
            <button type="button" class="chip" aria-pressed="false" data-c="공지">공지</button>
            <button type="button" class="chip" aria-pressed="false" data-c="문의">문의</button>
          </div>
          <button type="button" class="btn sm" id="ra">모두 읽음</button>
        </div>
<div class="card inl-4135303dac" id="al">
          <div class="item unread" data-c="위험">
            <div class="inl-97445a8d93">
              <span class="t">[위험] 초량1지하차도 침수 위험 단계</span>
              <span class="m">10-12 09:41</span>
            </div>
          </div>
          <div class="item unread" data-c="공지">
            <div class="inl-97445a8d93">
              <span class="t">[공지] 시스템 점검 안내 (10/15 02:00~04:00)</span>
              <span class="m">10-11 18:00</span>
            </div>
          </div>
          <div class="item unread" data-c="위험">
            <div class="inl-97445a8d93">
              <span class="t">[주의] 초량2지하차도 주의 단계로 상승</span>
              <span class="m">10-11 07:12</span>
            </div>
          </div>
          <div class="item" data-c="문의">
            <div class="inl-97445a8d93">
              <span class="t">[문의] "번호판 등록 오류"에 답변이 등록됐어요</span>
              <span class="m">10-10 14:20</span>
            </div>
          </div>
          <div class="item" data-c="위험">
            <div class="inl-97445a8d93">
              <span class="t">[안전] 초량1지하차도 안전 단계로 회복</span>
              <span class="m">10-09 21:03</span>
            </div>
          </div>
          <div class="item" data-c="공지">
            <div class="inl-97445a8d93">
              <span class="t">[공지] 앱 v1.2 업데이트 안내</span>
              <span class="m">10-08 10:00</span>
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
