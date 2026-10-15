import { createRouter, createWebHistory } from "vue-router";

const router = createRouter({
  scrollBehavior(_to, _from, savedPosition) {
    return savedPosition || { top: 0, left: 0 };
  },
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      component: () => import("../layouts/customer-layout.vue"),
      children: [
        {
          path: "info/sitemap",
          name: "customer-sitemap",
          component: () => import("../views/customer/support/sitemap.vue"),
          meta: { title: "사이트맵" },
        },
        {
          path: "",
          name: "customer-home",
          component: () => import("../views/customer/home.vue"),
          meta: { title: "고객 메인" },
        },
        {
          path: "signup",
          name: "customer-signup",
          component: () => import("../views/customer/auth/sign-up.vue"),
          meta: { title: "회원가입" },
        },
        {
          path: "login",
          name: "customer-login",
          component: () => import("../views/customer/auth/login.vue"),
          meta: { title: "로그인" },
        },
        { path: "mypage", name: "customer-mypage", component: () => import("../views/customer/account/my-page.vue"), meta: { title: "마이페이지" } },
        { path: "info/notices/:id", name: "customer-notice-detail", component: () => import("../views/customer/notices/notice-detail.vue"), meta: { headerTitle: "알림마당", title: "공지 상세" } },
        { path: "info/faq/:id", name: "customer-faq-detail", component: () => import("../views/customer/notices/faq-detail.vue"), meta: { headerTitle: "알림마당", title: "FAQ 상세" } },
        {
          path: "info/company",
          name: "customer-company",
          component: () => import("../views/customer/about/company.vue"),
          meta: { menuOrder: 0, headerTitle: "About us", title: "회사소개" },
        },
        {
          path: "info/history",
          name: "customer-history",
          component: () => import("../views/customer/about/history.vue"),
          meta: { menuOrder: 1, headerTitle: "About us", title: "연혁" },
        },
        {
          path: "info/business",
          name: "customer-business",
          component: () => import("../views/customer/about/business.vue"),
          meta: { menuOrder: 2, headerTitle: "About us", title: "사업설명" },
        },
        {
          path: "info/vision",
          name: "customer-vision",
          component: () => import("../views/customer/about/vision.vue"),
          meta: { menuOrder: 3, headerTitle: "About us", title: "비전" },
        },
        {
          path: "info/directions",
          name: "customer-directions",
          component: () => import("../views/customer/about/directions.vue"),
          meta: { menuOrder: 4, headerTitle: "About us", title: "오시는 길" },
        },
        {
          path: "info/global",
          name: "customer-global-locations",
          component: () =>
            import("../views/customer/about/global-locations.vue"),
          meta: {
            menuOrder: 5,
            headerTitle: "About us",
            title: "글로벌 사업장",
          },
        },
        {
          path: "info/underpasses",
          name: "customer-underpasses",
          component: () =>
            import("../views/customer/underpass/underpass-map.vue"),
          meta: {
            menuOrder: 6,
            headerTitle: "지하차도 통제 현황",
            title: "통제 현황",
          },
        },
        {
          path: "info/weather",
          name: "customer-weather",
          component: () => import("../views/customer/underpass/weather.vue"),
          meta: {
            menuOrder: 7,
            headerTitle: "지하차도 통제 현황",
            title: "날씨",
          },
        },
        {
          path: "info/notices",
          name: "customer-notice-list",
          component: () => import("../views/customer/notices/notice-list.vue"),
          meta: { menuOrder: 8, headerTitle: "알림마당", title: "공지사항" },
        },
        {
          path: "info/faq",
          name: "customer-faq",
          component: () => import("../views/customer/notices/faq.vue"),
          meta: {
            menuOrder: 9,
            headerTitle: "알림마당",
            title: "자주 묻는 질문",
          },
        },
        {
          path: "info/app-guide",
          name: "customer-app-features",
          component: () => import("../views/customer/app/app-features.vue"),
          meta: { menuOrder: 13, headerTitle: "앱", title: "앱 기능" },
        },
        {
          path: "info/app-download",
          name: "customer-app-download",
          component: () => import("../views/customer/app/app-download.vue"),
          meta: { menuOrder: 14, headerTitle: "앱", title: "앱 설치" },
        },
        {
          path: "info/its",
          name: "customer-its",
          component: () => import("../views/customer/links/its.vue"),
          meta: { menuOrder: 10, headerTitle: "연계 사이트", title: "ITS" },
        },
        {
          path: "info/kma",
          name: "customer-weather-agency",
          component: () => import("../views/customer/links/weather-agency.vue"),
          meta: { menuOrder: 11, headerTitle: "연계 사이트", title: "기상청" },
        },
        {
          path: "info/straffic",
          name: "customer-s-traffic",
          component: () => import("../views/customer/links/s-traffic.vue"),
          meta: {
            menuOrder: 12,
            headerTitle: "연계 사이트",
            title: "에스트래픽",
          },
        },
      ],
    },
    {
      path: "/:pathMatch(.*)*",
      name: "not-found",
      component: () => import("../views/not-found.vue"),
    },
  ],
});

export default router;
