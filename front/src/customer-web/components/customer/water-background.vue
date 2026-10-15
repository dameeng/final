<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useTheme } from '../../../shared/composables/theme';
import dayPhoto from '../../assets/images/customer-water.webp';
import nightPhoto from '../../assets/images/customer-waterNight.webp';
const props = defineProps<{ paused: boolean }>();
const theme = useTheme('routel-customer-theme');
const route = useRoute();
const photo = computed(() => theme.value === 'dark' ? nightPhoto : dayPhoto);
const world = ref<HTMLElement | null>(null), rise = ref<HTMLElement | null>(null);
const picture = ref<HTMLImageElement | null>(null), canvas = ref<HTMLCanvasElement | null>(null);
const ready = ref(false), reduced = ref(false);
let animation = 0, scrollFrame = 0, previous = 0, paintAt = 0, clock = 0;
let preference: MediaQueryList | undefined;
function position() {
 scrollFrame = 0;
 const pane = document.querySelector<HTMLElement>('.customer-page-frame');
 const pageProgress = window.scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight);
 const paneProgress = pane ? pane.scrollTop / Math.max(1, pane.scrollHeight - pane.clientHeight) : 0;
 const progress = Math.max(0, Math.min(1, Math.max(pageProgress, paneProgress)));
 rise.value?.style.setProperty('transform', `translateY(${innerHeight * .91 - (innerHeight * .91 - 35) * Math.pow(progress, .72)}px)`);
 world.value?.style.setProperty('--water-image-height', `${Math.max(innerHeight * 1.8, innerWidth * 9 / 16)}px`);
}
function schedule() { if (!scrollFrame) scrollFrame = requestAnimationFrame(position); }
function paint() {
 const image = picture.value, target = canvas.value, ctx = target?.getContext('2d');
 if (!image?.complete || !image.naturalWidth || !target || !ctx) return;
 const w = target.width, h = target.height, horizon = h * (theme.value === 'dark' ? .28 : .35);
 ctx.clearRect(0, 0, w, h);
 for (let y = 0; y < h; y += 4) {
  const depth = Math.max(0, (y - horizon) / (h - horizon));
  const wave = (Math.sin(y * .037 - clock * 1.35) * 5 + Math.sin(y * .082 + clock * .82) * 2.8) * Math.min(1, depth * 5);
  const band = Math.min(5, h - y);
  ctx.drawImage(image, 0, y * image.naturalHeight / h, image.naturalWidth, band * image.naturalHeight / h, -18 + wave, y, w + 36, band);
 }
 ctx.save(); ctx.globalCompositeOperation = 'screen';
 for (let i = 0; i < 32; i++) {
  const depth = .12 + ((i * 37) % 83) / 100, glow = Math.pow((Math.sin(clock * .85 + i * 2.3) + 1) / 2, 3);
  ctx.fillStyle = theme.value === 'dark' ? `rgba(170,210,255,${glow * .34})` : `rgba(255,255,245,${glow * .42})`;
  ctx.beginPath(); ctx.ellipse(((i * 173) % 1280) / 1280 * w + Math.sin(clock * .5 + i) * 9, horizon + (h - horizon) * Math.min(.97, depth) + Math.sin(clock * .7 + i * 1.2) * 2, (3 + depth * 10) * (.6 + glow * .4), .7 + depth * .8, 0, 0, Math.PI * 2); ctx.fill();
 }
 ctx.restore();
}
function prepare() {
 if (!canvas.value || !picture.value?.naturalWidth) return;
 canvas.value.width = Math.min(1280, picture.value.naturalWidth);
 canvas.value.height = Math.round(canvas.value.width * picture.value.naturalHeight / picture.value.naturalWidth);
 paint(); ready.value = true;
}
function tick(now: number) {
 animation = 0;
 if (props.paused || reduced.value || document.hidden) { previous = 0; return; }
 if (previous) clock += Math.min(.06, (now - previous) / 1000);
 previous = now;
 if (now - paintAt > 33) { paint(); paintAt = now; }
 animation = requestAnimationFrame(tick);
}
function sync() {
 cancelAnimationFrame(animation); animation = 0; previous = 0;
 if (!props.paused && !reduced.value && !document.hidden) animation = requestAnimationFrame(tick);
}
function preferenceChanged() { reduced.value = preference?.matches ?? false; sync(); }
watch(() => props.paused, sync);
watch(photo, () => { ready.value = false; });
watch(() => route.fullPath, async () => { await nextTick(); schedule(); });
onMounted(() => {
 preference = matchMedia('(prefers-reduced-motion: reduce)'); preferenceChanged();
 preference.addEventListener('change', preferenceChanged);
 document.addEventListener('scroll', schedule, { passive: true, capture: true });
 document.addEventListener('visibilitychange', sync); window.addEventListener('resize', schedule);
 position(); prepare();
});
onBeforeUnmount(() => {
 cancelAnimationFrame(animation); cancelAnimationFrame(scrollFrame);
 preference?.removeEventListener('change', preferenceChanged);
 document.removeEventListener('scroll', schedule, true); document.removeEventListener('visibilitychange', sync); window.removeEventListener('resize', schedule);
});
</script>
<template>
 <div ref="world" class="customer-water-world" :class="{ paused: paused || reduced }" aria-hidden="true">
  <div ref="rise" class="customer-water-rise"><img ref="picture" :src="photo" alt="" @load="prepare" /><canvas ref="canvas" :class="{ ready: ready && !reduced }"></canvas><div class="customer-sun-glints"><i v-for="i in 9" :key="i" :style="{left:`${8+(i*37)%84}%`,top:`${2+(i*11)%34}%`,animationDelay:`${-i*.83}s`,animationDuration:`${3.8+(i%4)*.65}s`}"></i></div></div>
  <div class="customer-fireflies"><i v-for="i in 22" :key="i" :style="{ left: `${3 + ((i - 1) * 43) % 94}%`, top: `${14 + ((i - 1) * 29) % 78}%`, animationDelay: `${-i * 2.7}s`, animationDuration: `${17 + i % 9}s` }"><span></span></i></div>
 </div>
</template>
