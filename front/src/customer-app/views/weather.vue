<script setup lang="ts">
import { ref } from "vue";
import { useApp } from "../composables/use-app";
import { useLoad } from "../composables/use-load";
import { api } from "../services/api";
import type { Weather } from "../services/types";
import LoadState from "../components/load-state.vue";
const { state } = useApp(),
  region = ref("서울");
// 백엔드 /api/weather는 지역 이름이 아니라 위경도를 받아 가장 가까운 날씨 지역을 돌려줍니다.
// 그래서 선택한 지역의 대표 도시(도청 소재지) 좌표로 조회합니다.
const regions: Record<string, [number, number]> = {
  서울: [37.5665, 126.978],
  부산: [35.1796, 129.0756],
  대구: [35.8714, 128.6014],
  인천: [37.4563, 126.7052],
  광주: [35.1595, 126.8526],
  대전: [36.3504, 127.3845],
  울산: [35.5384, 129.3114],
  세종: [36.48, 127.289],
  경기: [37.2636, 127.0286],
  강원: [37.8813, 127.7298],
  충북: [36.6424, 127.489],
  충남: [36.6588, 126.6728],
  전북: [35.8242, 127.148],
  전남: [34.816, 126.463],
  경북: [36.5684, 128.7294],
  경남: [35.228, 128.6811],
  제주: [33.4996, 126.5312],
};
const { data, loading, error, reload } = useLoad(async (): Promise<Weather> => {
  if (state.demo)
    return {
      areaName: region.value,
      temperature: 22,
      humidity: 70,
      rainfall: 3,
      condition: "비",
      observedAt: "2026-09-17 09:00",
      hourly: [
        { time: "10시", temperature: 22, rainfall: 3, precipitationProbability: 60 },
        { time: "11시", temperature: 23, rainfall: 1, precipitationProbability: 40 },
      ],
      daily: [
        { date: "9/17(목)", minTemperature: 18, maxTemperature: 25, precipitationProbability: 60 },
        { date: "9/18(금)", minTemperature: 17, maxTemperature: 26, precipitationProbability: 20 },
      ],
    };
  const [lat, lng] = regions[region.value];
  return api.weather(lat, lng);
});
const show = (value: number | null, unit: string) =>
  value === null || value === undefined ? "미수신" : value + unit;
</script>
<template>
  <main>
    <h1>지역별 날씨</h1>
    <form @submit.prevent="reload">
      <label
        >지역
        <select v-model="region" @change="reload">
          <option v-for="(_, r) in regions" :key="r">{{ r }}</option>
        </select></label
      ><button :disabled="loading">조회</button>
    </form>
    <LoadState :loading="loading" :error="error" @retry="reload" />
    <section v-if="data">
      <h2>{{ data.areaName }}</h2>
      <!-- 기상 안내(advisory), 현재 강수 확률: 응답에 없음 (시간별·일별 예보에만 강수 확률이 있습니다) -->
      <dl>
        <dt>현재 기온</dt>
        <dd>{{ show(data.temperature, " ℃") }}</dd>
        <dt>현재 습도</dt>
        <dd>{{ show(data.humidity, " %") }}</dd>
        <dt>시간당 강우량</dt>
        <dd>{{ show(data.rainfall, " mm") }}</dd>
        <dt>날씨 상태</dt>
        <dd>{{ data.condition || "미수신" }}</dd>
        <dt>기준 시각</dt>
        <dd>{{ data.observedAt || "미수신" }}</dd>
      </dl>
      <h3>시간별 예보</h3>
      <ul>
        <li v-for="h in data.hourly" :key="h.time">
          {{ h.time }} · {{ show(h.temperature, " ℃") }} · 강우량 {{ show(h.rainfall, " mm") }} · 강수 확률
          {{ show(h.precipitationProbability, "%") }}
        </li>
      </ul>
      <p v-if="!data.hourly.length">시간별 예보가 없습니다.</p>
      <h3>일별 예보</h3>
      <ul>
        <li v-for="d in data.daily" :key="d.date">
          {{ d.date }} · {{ show(d.minTemperature, " ℃") }} ~ {{ show(d.maxTemperature, " ℃") }} · 강수 확률
          {{ show(d.precipitationProbability, "%") }}
        </li>
      </ul>
      <p v-if="!data.daily.length">일별 예보가 없습니다.</p>
    </section>
    <p>강수 확률은 지하차도 침수 확률과 다릅니다.</p>
  </main>
</template>