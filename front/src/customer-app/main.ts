import {useTheme} from '../shared/composables/theme';
import '../shared/styles/customer-theme.css';
useTheme('routel-app-theme');
import "./styles/index.css";
import { createApp } from "vue";
import { registerSW } from "virtual:pwa-register";
import App from "./App.vue";
import router from "./router";
registerSW({
  onRegisterError(error) {
    console.error("앱 오프라인 준비 실패", error);
  },
});
createApp(App).use(router).mount("#app");
