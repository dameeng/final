import { createRouter, createWebHashHistory } from "vue-router";
export default createRouter({
  history: createWebHashHistory(),
  scrollBehavior: () => ({ top: 0 }),
  routes: [
    { path: "/navigation", component: () => import("../views/navigation.vue") },
    { path: "/", component: () => import("../views/home.vue") },
    {
      path: "/underpasses",
      component: () => import("../views/underpass-list.vue"),
    },
    {
      path: "/underpasses/:id",
      component: () => import("../views/underpass-detail.vue"),
    },
    {
      path: "/notifications",
      component: () => import("../views/notifications.vue"),
    },
    { path: "/weather", component: () => import("../views/weather.vue") },
    { path: "/notices", component: () => import("../views/notices.vue") },
    {
      path: "/notices/:id",
      component: () => import("../views/notice-detail.vue"),
    },
    { path: "/login", component: () => import("../views/login.vue") },
    { path: "/signup", component: () => import("../views/sign-up.vue") },
    { path: "/mypage", component: () => import("../views/my-page.vue") },
    { path: "/help", component: () => import("../views/help.vue") },
    {
      path: "/:pathMatch(.*)*",
      component: () => import("../views/not-found.vue"),
    },
  ],
});
