<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { customerSession, logoutCustomer } from '../../services/session';
import headerMascot from '../../../shared/assets/images/routel-header-mascot.png';
const router = useRouter(), route = useRoute();
const header = ref<HTMLElement | null>(null);
const menuNav=ref<HTMLElement|null>(null);
function alignMenus(){if(!header.value||!menuNav.value)return;const a=header.value.getBoundingClientRect(),b=menuNav.value.getBoundingClientRect();header.value.style.setProperty("--menu-left",`${b.left-a.left}px`);header.value.style.setProperty("--menu-width",`${b.width}px`);}
const opened = ref<string | null>(null);
let hoverOpened = false;
function hover(id: string) {
 if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
 if (!opened.value) hoverOpened = true;
 opened.value = id;
}
function toggle(id: string) {
 opened.value = hoverOpened ? id : opened.value === id ? null : id;
 hoverOpened = false;
}
function leave() {
 if (!header.value?.contains(document.activeElement)) { opened.value = null; hoverOpened = false; }
}
const menus = computed(() => ['About us', '지하차도 통제 현황', '알림마당', '연계 사이트', '앱'].map((label, index) => ({
 id: `customer-menu-${index}`, label,
 items: router.getRoutes().filter(r => r.meta.headerTitle === label && !r.path.includes(':'))
 .sort((a,b) => Number(a.meta.menuOrder || 0) - Number(b.meta.menuOrder || 0))
 .map(r => ({label: String(r.meta.title || label), to: r.path}))
})));
watch(() => route.fullPath, () => { opened.value = null; });
function close() {
 if (opened.value) header.value?.querySelector<HTMLButtonElement>(`[data-menu-id="${opened.value}"]`)?.focus();
 opened.value = null;
}
function outside(e: PointerEvent) { if (!header.value?.contains(e.target as Node)) opened.value = null; }
function blur(e: FocusEvent) { if (!header.value?.contains(e.relatedTarget as Node | null)) opened.value = null; }
async function logout() {
 try { await logoutCustomer(); await router.push('/'); }
 catch(e) { window.alert(e instanceof Error ? e.message : '로그아웃에 실패했습니다.'); }
}
let observer: ResizeObserver | undefined;
onMounted(() => {
 observer = new ResizeObserver(() => {document.documentElement.style.setProperty('--routel-header-height', `${header.value?.getBoundingClientRect().height || 88}px`);alignMenus();});
 if(header.value) observer.observe(header.value);
 if(menuNav.value) observer.observe(menuNav.value);
 document.addEventListener('pointerdown', outside);
});
onBeforeUnmount(() => { observer?.disconnect(); document.removeEventListener('pointerdown', outside); document.documentElement.style.removeProperty('--routel-header-height'); });
</script>
<template>
 <header ref="header" class="customer-header-header" @keydown.esc="close" @focusout="blur" @mouseleave="leave">
  <div class="customer-header-inner">
   <RouterLink to="/" class="customer-logo" aria-label="ROUTEL 고객 홈"><img :src="headerMascot" alt="" /><span>ROUTEL<small>당신의 길에, 안심을 더하다.</small></span></RouterLink>
   <nav ref="menuNav" class="customer-header-nav" aria-label="고객 상위 메뉴">
    <div v-for="menu in menus" :key="menu.id" class="customer-menu-group">
     <button type="button" :aria-expanded="opened !== null" aria-controls="customer-mega-menu" :class="{ 'is-current': route.meta.headerTitle === menu.label }" @mouseenter="hover(menu.id)" @click="toggle(menu.id)" :data-menu-id="menu.id">{{ menu.label }}</button>

    </div>
   </nav>
   <nav class="customer-member-nav" aria-label="회원 메뉴">
    <template v-if="customerSession.id"><span class="customer-member-name">{{ customerSession.name }}님</span><button type="button" @click="logout">로그아웃</button></template>
    <template v-else><RouterLink to="/login">로그인</RouterLink><RouterLink to="/signup">회원가입</RouterLink></template>
    <RouterLink to="/mypage">마이페이지</RouterLink>
   </nav>
  </div>
  <Transition name="customer-menu-drop">
   <div v-if="opened" id="customer-mega-menu" class="customer-hover-mega">
    <nav class="customer-hover-groups" aria-label="전체 하위 메뉴">
     <section v-for="menu in menus" :key="menu.id" :aria-label="menu.label">
      
      <RouterLink v-for="item in menu.items" :key="item.to" :to="item.to">{{ item.label }}</RouterLink>
     </section>
    </nav>
   </div>
  </Transition>
 </header>
</template>
<style scoped src="../../styles/components/customer/customer-header.css"></style>
