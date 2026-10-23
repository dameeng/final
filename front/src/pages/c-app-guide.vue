<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import '../styles/c-app-guide.css'

type FeatureId = 'map' | 'alert' | 'route'
type Feature = {
  id: FeatureId
  number: string
  label: string
  title: string
  description: string
  screenTitle: string
}
type Platform = 'android' | 'ios'
const features: Feature[] = [
  {
    id: 'map',
    number: '01',
    label: '지하차도 통제 현황',
    title: '가는 길의 상태를, 한눈에.',
    description:
      '지도에서 지하차도의 통제 상태와 인근 날씨를 함께 살펴보세요. 필요한 시설을 누르면 상세 정보를 확인할 수 있어요.',
    screenTitle: '내 주변 지하차도',
  },
  {
    id: 'alert',
    number: '02',
    label: '위험 알림',
    title: '필요한 순간에, 안전 소식.',
    description:
      '관심 시설의 위험 단계와 통제 소식을 확인하세요. 알림 내역을 모아 보고 필요한 정보를 다시 찾아볼 수 있어요.',
    screenTitle: '나의 안전 알림',
  },
  {
    id: 'route',
    number: '03',
    label: '이동 준비',
    title: '출발하기 전에, 한 번 더.',
    description:
      '이동할 구간의 지하차도를 확인하고 통제 구간을 살펴보세요. 날씨와 시설 정보를 바탕으로 이동을 준비할 수 있어요.',
    screenTitle: '이동 전 확인하기',
  },
]
const selected = ref<FeatureId>('map'),
  platform = ref<Platform>('android')
const current = computed(() => features.find((f) => f.id === selected.value)!)
const steps = computed(() =>
  platform.value === 'android'
    ? [
        'Google Play 설치 링크가 열리면 ROUTEL 앱을 설치해 주세요.',
        '앱을 실행하고 회원 정보를 입력해 주세요.',
        '필요한 알림을 설정하고 지하차도 정보를 확인하세요.',
      ]
    : [
        'App Store 설치 링크가 열리면 ROUTEL 앱을 설치해 주세요.',
        '앱을 실행하고 회원 정보를 입력해 주세요.',
        '알림 수신을 설정하고 관심 시설을 확인하세요.',
      ],
)
</script>
<template>
  <main class="wire-page app-guide-page">
    <section class="app-guide-hero" aria-labelledby="app-guide-title">
      <div class="app-guide-hero-copy"
        ><p class="app-guide-eyebrow"><span></span> YOUR EVERYDAY SAFETY PARTNER</p
        ><p class="app-guide-kicker">ROUTEL APP · 앱 소개</p
        ><h1 id="app-guide-title">비 오는 날에도,<br />안전한 길을 먼저.</h1
        ><p class="app-guide-lead"
          >매일 지나가는 지하차도,<br />이제 출발 전에 ROUTEL로 확인하세요.</p
        ><div class="app-guide-actions"
          ><a class="app-guide-button primary" href="#install"
            >앱 설치 안내 <span aria-hidden="true">↗</span></a
          ><RouterLink class="app-guide-button secondary" to="/customer-app/screen-1"
            >앱 화면 살펴보기 <span aria-hidden="true">→</span></RouterLink
          ></div
        ><div class="app-guide-hero-tags"
          ><span>지하차도 통제 현황</span><span>인근 날씨</span><span>안전 알림</span></div
        ></div
      >
   <div class="app-guide-visual"
        ><div class="app-guide-orbit orbit-one"></div><div class="app-guide-orbit orbit-two"></div
        ><div class="app-guide-floating-note"
          ><span class="app-guide-status-dot"></span> 이동 전 확인하는 작은 습관</div
        ><div class="app-guide-phone" aria-label="ROUTEL 앱 화면 예시"
          ><div class="app-guide-phone-notch"></div
          ><div class="app-guide-phone-top"
            ><b>ROUTEL<span>●</span></b
            ><svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              stroke-width="1.7"
              aria-hidden="true"
            >
              <path d="M6 8a6 6 0 0 1 12 0c0 6 3 7 3 9H3c0-2 3-3 3-9m4 13h4" /></svg></div
          ><div class="app-guide-phone-heading"
            ><small>오늘도 안전하게</small><h2>{{current.screenTitle}}</h2></div
          ><div class="app-guide-phone-map"
            ><svg
              viewBox="0 0 280 280"
              role="img"
              aria-label="지하차도 위치를 보여주는 앱 화면 예시"
            >
              <rect width="280" height="280" fill="#edf2f7" />
              <path
                d="M210-20c-80 70 80 95 20 160s-70 80-40 160"
                fill="none"
                stroke="#bfd8ee"
                stroke-width="40"
              />
              <g fill="none" stroke="#fff" stroke-width="14">
                <path d="m-20 50 320 170M25-20l120 320M-20 200 320-120" />
              </g>
              <g fill="none" stroke="#d7c8a9" stroke-width="4">
                <path d="m-20 50 320 170M25-20l120 320M-20 200 320-120" />
              </g>
              <g fill="#d4e2dd">
                <rect x="16" y="92" width="35" height="35" rx="8" />
                <rect x="150" y="20" width="25" height="40" rx="7" />
                <rect x="65" y="210" width="25" height="32" rx="7" />
              </g>
              <circle cx="110" cy="160" r="22" fill="#16805d" opacity=".12" />
              <circle cx="110" cy="160" r="11" fill="#16805d" stroke="white" stroke-width="4" />
              <circle cx="195" cy="105" r="11" fill="#ef9a32" stroke="white" stroke-width="4" />
              <circle cx="70" cy="67" r="10" fill="#16805d" stroke="white" stroke-width="4" />
              <circle cx="180" cy="230" r="7" fill="#2e75be" stroke="white" stroke-width="3" /></svg
            ><div class="app-guide-map-chip">부산 지하차도 <span>↗</span></div></div
          ><div class="app-guide-phone-info" v-if="selected==='map'"
            ><span class="app-guide-mini-badge">안전</span><b>지하차도 상태 확인</b
            ><small>통제 현황 · 인근 날씨</small></div
          ><div class="app-guide-phone-info" v-else-if="selected==='alert'"
            ><span class="app-guide-mini-badge orange">알림</span><b>관심 시설의 새로운 소식</b
            ><small>위험 단계와 통제 정보를 확인하세요.</small></div
          ><div class="app-guide-phone-info" v-else
            ><span class="app-guide-mini-badge">출발 전</span><b>이동 구간을 살펴보세요</b
            ><small>가는 길의 시설 정보 한눈에 보기</small></div
          ><div class="app-guide-phone-nav"
            ><span class="active">현황</span><span>알림</span><span>내 정보</span></div
          ></div
        ><p class="app-guide-preview-caption">앱 화면 예시</p></div
      >
    </section>
  <section class="app-guide-feature-section" aria-labelledby="app-features-title"
      ><div class="app-guide-section-heading"
        ><p class="app-guide-eyebrow">LESS WORRY, SAFER JOURNEY</p
        ><h2 id="app-features-title">복잡한 정보는 덜고,<br />필요한 안전 정보만.</h2
        ><p>지도부터 알림까지, 한곳에서 편하게 확인하세요.</p></div
      ><div class="app-guide-feature-tabs" role="group" aria-label="앱 주요 기능"
        ><button
          v-for="feature in features"
          :key="feature.id"
          :aria-label="feature.label"
          :aria-pressed="selected===feature.id"
          @click="selected=feature.id"
          ><span class="app-guide-feature-icon" aria-hidden="true"
            ><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <template v-if="feature.id==='map'"><path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2V5Z"/><path d="M9 3v16m6-14v16"/></template>
              <template v-else-if="feature.id==='alert'"><path d="M6 8a6 6 0 0 1 12 0c0 6 2 7 2 9H4c0-2 2-3 2-9Z"/><path d="M10 21h4"/></template>
              <template v-else><circle cx="6" cy="6" r="3"/><circle cx="18" cy="18" r="3"/><path d="M6 9v6a3 3 0 0 0 3 3h6M12 6h7m-3-3 3 3-3 3"/></template>
            </svg></span
          ><span class="app-guide-feature-label"><small>{{feature.number}}</small>{{feature.label}}</span
          ><svg class="app-guide-feature-arrow"
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            aria-hidden="true"
          >
            <path d="M5 12h14m-5-5 5 5-5 5" /></svg></button></div
      ><div class="app-guide-feature-detail" aria-live="polite"
        ><span class="app-guide-feature-number">{{current.number}}</span
        ><div
          ><h3>{{current.title}}</h3
          ><p>{{current.description}}</p></div
        ><RouterLink to="/c-map"
          >웹에서 현황 보기 <span aria-hidden="true">↗</span></RouterLink
        ></div
      ></section
    >
  <section id="install" class="app-guide-install" aria-labelledby="app-install-title"
      ><div
        ><p class="app-guide-eyebrow">READY FOR YOUR NEXT JOURNEY</p
        ><h2 id="app-install-title">안전한 이동의 시작,<br />ROUTEL과 함께하세요.</h2
        ><p
          >Android와 iPhone에서 만날 준비를 하고 있어요.<br />공식 설치 주소는 준비되는 대로 안내합니다.</p
        ><RouterLink class="app-guide-button primary" to="/customer-app/screen-1"
          >고객 앱 열기 <span aria-hidden="true">→</span></RouterLink
        ></div
      ><div class="app-guide-install-panel"
        ><div class="app-guide-platforms" role="group" aria-label="설치 운영체제 선택"
          ><button :aria-pressed="platform==='android'" @click="platform='android'">Android</button
          ><button :aria-pressed="platform==='ios'" @click="platform='ios'">iPhone</button></div
        ><ol
          ><li v-for="(step,index) in steps" :key="platform+index"
            ><span>{{String(index+1).padStart(2,'0')}}</span
            ><p>{{step}}</p></li
          ></ol
        ><p class="app-guide-store-status"
          >{{platform==='android'?'Google Play':'App Store'}} · 출시 준비 중</p
        ></div
      ></section
    >
  </main>
</template>
