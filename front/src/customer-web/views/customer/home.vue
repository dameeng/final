<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import heroImage from "../../assets/images/customer-hero-blue-hour.png";

const track = ref<HTMLElement | null>(null);
const scenery = ref<HTMLElement | null>(null);
const stage = ref<HTMLElement | null>(null);
const content = ref<HTMLElement | null>(null);
const reduced = ref(false);
const mediaFailed = ref(false);
const introHidden = ref(false);
const copyHidden = ref(true);
const actionsHidden = ref(true);
let frame = 0;
let observer: ResizeObserver | undefined;
let motion: MediaQueryList | undefined;
let geometryDirty = true;
let geometry = { header: 0, travel: 1 };
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const ease = (value: number) => value * value * (3 - 2 * value);

function update() {
  frame = 0;
  if (!track.value || !stage.value || !content.value) return;
  const simple = reduced.value;
  if (geometryDirty) {
    geometry = {
      header: parseFloat(getComputedStyle(stage.value).top) || 0,
      travel: Math.max(1, track.value.offsetHeight - stage.value.clientHeight),
    };
    geometryDirty = false;
  }
  const progress = simple ? 1 : clamp(
    (geometry.header - track.value.getBoundingClientRect().top) / (geometry.travel * 0.88),
  );
  // Let the pale landscape emerge gradually through the end of the GIF fade.
  scenery.value?.style.setProperty("--scenery-reveal", String(simple ? 1 : ease(clamp((progress - 0.45) / 0.55))));
  const fade = ease(clamp(progress / 0.65));
  const style = stage.value.style;
  style.setProperty("--hero-scale", "1");
  style.setProperty("--hero-media-opacity", String(1 - fade));
  style.setProperty("--hero-intro", String(1 - ease(clamp(progress / 0.35))));
  const steps = [clamp((progress - 0.48) / 0.25), clamp((progress - 0.60) / 0.22), clamp((progress - 0.70) / 0.22)];
  steps.forEach((value, index) => {
    style.setProperty(`--hero-reveal-${index}`, String(value));
    style.setProperty(`--hero-rise-${index}`, `${24 * (1 - value)}px`);
  });
  introHidden.value = !!simple || progress >= 0.35;
  copyHidden.value = !simple && steps[0]! === 0;
  actionsHidden.value = !simple && steps[2]! < 0.95;
}
function schedule() {
  if (!frame) frame = requestAnimationFrame(update);
}
function resized() {
  geometryDirty = true;
  schedule();
}
function preferenceChanged() {
  reduced.value = motion?.matches ?? false;
  resized();
}
onMounted(() => {
  motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  preferenceChanged();
  motion.addEventListener("change", preferenceChanged);
  observer = new ResizeObserver(resized);
  if (stage.value) observer.observe(stage.value);
  if (content.value) observer.observe(content.value);
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", resized);

});
onBeforeUnmount(() => {
  cancelAnimationFrame(frame);
  observer?.disconnect();
  motion?.removeEventListener("change", preferenceChanged);
  window.removeEventListener("scroll", schedule);
  window.removeEventListener("resize", resized);
});
const visionRoadmap = [
  {
    year: '2026',
    title: '안전 정보의 기반을 다지겠습니다',
    description: '지하차도 통제 현황과 기상 정보를 한곳에서 확인할 수 있는 기본 서비스를 구축하겠습니다.',
  },
  {
    year: '2027',
    title: '필요한 안내를 제때 전달하겠습니다',
    description: '관심 지역과 시설의 통제 정보를 확인하고 알림을 받을 수 있도록, 이용자 중심의 안내 기능을 고도화하겠습니다.',
  },
  {
    year: '2028',
    title: '위험 변화를 더 세심하게 살피겠습니다',
    description: '축적된 기상·시설 데이터를 활용해 위험 분석의 정확도를 검증하고 개선하겠습니다.',
  },
  {
    year: '2030',
    title: '더 넓은 지역의 안전한 이동을 돕겠습니다',
    description: '서비스 적용 지역을 단계적으로 확대하고, 이용자와 시설 관리자를 연결하는 안전 정보 체계를 발전시키겠습니다.',
  },
];
</script>
<template>
  <main class="home-main">
    <div class="routel-home-story">
      <div ref="scenery" class="routel-home-scenery" aria-hidden="true"></div>
    <section ref="track" class="routel-hero" aria-label="ROUTEL 교통안전 서비스 소개">
      <div ref="stage" class="routel-hero-stage">
        <div class="routel-hero-media">
          <img v-if="!mediaFailed" :src="heroImage"
            alt="비가 그친 푸른 저녁, 젖은 도로에 조명이 비치는 지하차도 입구"
            fetchpriority="high" decoding="async" @error="mediaFailed = true" />
          <span v-else class="routel-hero-fallback">ROUTEL · 도로 위의 안전을 생각합니다</span>
        </div>
        <div class="routel-hero-intro" :aria-hidden="introHidden">
          <div class="routel-hero-intro-inner">
            <p class="routel-hero-eyebrow">지하차도 안전을 위한 기술, ROUTEL</p>
            <h1>안전한 도로,<br />안심할 수 있는 일상</h1>
            <p class="routel-hero-scroll"><span class="routel-hero-scroll-text">스크롤하여 더 알아보기</span>
              <svg class="routel-hero-scroll-arrow" aria-hidden="true" viewBox="0 0 24 24" fill="none"><path d="m5 9 7 7 7-7" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" /></svg></p>
          </div>
        </div>
        <div ref="content" class="routel-hero-content">
          <div class="routel-hero-copy" :aria-hidden="copyHidden">
            <div class="routel-hero-heading">
              <p class="routel-hero-eyebrow">지하차도 안전을 위한 기술, ROUTEL</p>
              <h2><span>다시는 ‘아무도 몰랐다’는 말이 없도록.</span><span class="routel-hero-promise">물이 차오르기 전에, 먼저 알려드리겠습니다.</span></h2>
            </div>
            <p class="routel-hero-description">지하차도 통제 현황과 기상 정보를 한곳에서 확인하고, 이동 전부터 이동 중까지, 안전한 길을 함께 확인하세요.</p>
            <div class="routel-hero-actions" :inert="actionsHidden" :aria-hidden="actionsHidden">
              <RouterLink to="/info/underpasses" class="routel-hero-button routel-hero-button-primary" :tabindex="actionsHidden ? -1 : undefined">지하차도 통제 현황</RouterLink>
              <RouterLink to="/info/business" class="routel-hero-button" :tabindex="actionsHidden ? -1 : undefined">서비스 소개</RouterLink>
            </div>
          </div>
        </div>
      </div>
    </section>
    <section class="routel-services" aria-labelledby="routel-services-title">
      <div class="routel-services-intro">
        <p class="routel-services-eyebrow">ROUTEL의 역할</p>
        <h2 id="routel-services-title">도로의 상황을 살피고,<br />안전한 이동을 돕습니다.</h2>
        <p class="routel-services-summary">지하차도 통제 현황과 기상 정보를 연결해, 이동 전부터 이동 중까지 필요한 안전 정보를 안내합니다.</p>
      </div>
      <ol class="routel-services-list" role="list">
        <li class="routel-services-item">
          <span class="routel-services-number" aria-hidden="true">01</span>
          <div>
            <h3>지하차도 통제 현황 확인</h3>
            <p>지도에서 지하차도의 위치와 통제 여부를 확인하고, 이동할 구간의 상황을 살펴보세요.</p><RouterLink to="/info/underpasses">자세히 보기 ↗</RouterLink>
          </div>
        </li>
        <li class="routel-services-item">
          <span class="routel-services-number" aria-hidden="true">02</span>
          <div>
            <h3>기상 정보 확인</h3>
            <p>지역별 기상 정보를 확인하고, 비가 오는 날의 이동을 미리 준비하세요.</p><RouterLink to="/info/weather">자세히 보기 ↗</RouterLink>
          </div>
        </li>
        <li class="routel-services-item">
          <span class="routel-services-number" aria-hidden="true">03</span>
          <div>
            <h3>필요한 안전 안내 확인</h3>
            <p>공지사항과 이용 안내를 통해 서비스 이용에 필요한 정보를 확인하세요.</p><RouterLink to="/info/notices">자세히 보기 ↗</RouterLink>
          </div>
        </li>
      </ol>
    </section>
    </div>
    <section class="customer-photo-band"><div><p>YOUR EVERYDAY, SAFELY CONNECTED</p><h2>당신의 길에,<br />안심을 더하다.</h2><RouterLink to="/info/company">ROUTEL 알아보기 ↗</RouterLink></div></section>
    <section class="routel-vision" aria-labelledby="routel-vision-title">
      <div class="routel-vision-inner">
        <header class="routel-vision-heading">
          <p class="routel-vision-eyebrow">ROUTEL VISION 2030</p>
          <h2 id="routel-vision-title">2030년까지,<br />더 촘촘한 지하차도 안전 정보 서비스를 만들어가겠습니다.</h2>
          <p class="routel-vision-description">정보 확인부터 위험 변화 파악과 신속한 안내까지,<br class="routel-vision-break" /> 안전한 이동을 돕는 서비스를 단계적으로 발전시키겠습니다.</p>
        </header>
        <ol class="routel-vision-roadmap" role="list" aria-label="연도별 추진 목표">
          <li v-for="goal in visionRoadmap" :key="goal.year" class="routel-vision-row">
            <span class="routel-vision-year">{{ goal.year }}</span>
            <div class="routel-vision-goal">
              <h3>{{ goal.title }}</h3>
              <p>{{ goal.description }}</p>
            </div>
          </li>
        </ol>
       
      </div>
    </section>
    <section class="customer-closing"><p>WITH YOU ON THE ROAD</p><h2>이동하는 모든 순간, 당신의 길을 함께합니다.</h2><RouterLink class="routel-hero-button routel-hero-button-primary" to="/info/underpasses">지하차도 통제 현황 확인 ↗</RouterLink></section>
  </main>
</template>
<style scoped src="../../styles/views/customer/home.css"></style>
