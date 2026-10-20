<script setup lang="ts">

const principles = [
  { number: '01', title: '이해하기 쉬운 정보', description: '지하차도의 위치와 통제 여부를 이용자가 쉽게 살펴볼 수 있는 화면을 지향합니다.' },
  { number: '02', title: '필요한 정보의 연결', description: '도로와 시설의 안전 정보를 연결해, 이동 전 상황을 살펴보는 과정을 돕습니다.' },
  { number: '03', title: '꾸준한 확인과 개선', description: '정보의 출처와 갱신 상태를 확인하기 쉬운 방향으로 서비스를 개선하고, 이용자의 의견을 바탕으로 사용성을 높여가겠습니다.' },
];
</script>
<template>
  <main class="wire-page customer-content page-c-company">
    <header class="routel-company-hero">
      <p class="routel-company-eyebrow">ABOUT ROUTEL</p>
      <h1>도로의 정보를 연결해,<br />안전한 이동을 돕습니다.</h1>
      <div class="routel-company-lead">
        <p>ROUTEL은 지하차도 통제 현황을 한곳에서 확인할 수 있도록 돕는 교통안전 정보 서비스입니다.</p>
        <p>이동을 준비하는 이용자가 필요한 정보를 쉽게 찾고 이해할 수 있는 서비스를 지향합니다.</p>
      </div>
    </header>
    <section class="routel-company-context" aria-labelledby="company-context-title">
      <div>
        <p class="routel-company-eyebrow">우리가 주목하는 것</p>
        <h2 id="company-context-title">이동 전에 필요한 정보,<br />쉽게 확인할 수 있어야 합니다.</h2>
      </div>
      <div class="routel-company-prose">
        <p>이동 전에는 이동할 구간의 지하차도 통제 여부를 살펴볼 필요가 있습니다.</p>
        <p>ROUTEL은 이러한 정보를 한곳에서 확인할 수 있도록 연결하고, 복잡한 정보도 이용자가 이해하기 쉬운 형태로 전달하고자 합니다.</p>
      </div>
    </section>
    <section class="company-services" aria-labelledby="company-services-title"><p class="routel-company-eyebrow">OUR SERVICES</p><h2 id="company-services-title">이동 전에 확인하는 안전 정보</h2><div class="routel-services"><div><h3>지하차도 통제 현황</h3><p>지하차도의 위치와 통제 여부를 지도에서 확인합니다.</p><RouterLink to="/c-map">통제 현황 확인 →</RouterLink></div><div><h3>안전 안내</h3><p>공지사항과 이용 안내를 통해 필요한 정보를 확인합니다.</p><RouterLink to="/c-notice">알림마당 →</RouterLink></div></div></section>
    <section class="routel-company-principles" aria-labelledby="company-principles-title">
      <p class="routel-company-eyebrow">서비스의 기준</p>
      <h2 id="company-principles-title">정보는 명확하게,<br />이용은 편리하게.</h2>
      <ol class="routel-company-principle-list" role="list">
        <li v-for="principle in principles" :key="principle.number">
          <span class="routel-company-number" aria-hidden="true">{{ principle.number }}</span>
          <h3>{{ principle.title }}</h3>
          <p>{{ principle.description }}</p>
        </li>
      </ol>
    </section>
    <section class="routel-company-direction" aria-labelledby="company-direction-title">
      <p class="routel-company-eyebrow">OUR DIRECTION</p>
      <h2 id="company-direction-title">더 많은 정보보다,<br />더 이해하기 쉬운 안전 정보로.</h2>
      <p class="routel-company-direction-copy">ROUTEL은 이용자가 이동 전 상황을 살펴보고 안전한 이동을 준비할 수 있도록, 정보의 연결과 전달 방식을 꾸준히 다듬어가겠습니다.</p>
    </section>
    <section class="routel-company-mascot" aria-labelledby="company-mascot-title">

      <div class="routel-company-mascot-copy">
        <p class="routel-company-eyebrow">ROUTEL MASCOT</p>
        <h2 id="company-mascot-title">ROUTEL의 작은 안전 안내자, 루</h2>
        <p>루는 ROUTEL의 앞부분인 ‘ROU’에서 이름을 따온 마스코트입니다. 짧고 친근한 이름처럼, 누구나 편하게 도로 안전 정보를 만날 수 있도록 곁에서 안내합니다.</p>
        <p>루는 위험을 마법처럼 없애는 영웅보다, 작은 변화도 그냥 지나치지 않는 꼼꼼한 친구에 가깝습니다. 주황색 안전 조끼를 챙겨 입고, 어렵게 느껴지는 도로 정보를 알기 쉬운 말로 전하는 것이 루의 역할입니다.</p>
      </div>
    </section>

  </main>
</template>
