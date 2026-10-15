import { applyBrowserIcons } from '../shared/utils/browser-icons'
applyBrowserIcons()
import {useTheme} from '../shared/composables/theme';
import '../shared/styles/customer-theme.css';
useTheme('routel-customer-theme');
import "../shared/assets/fonts/noto-sans-kr/index.css";
import "./styles/common.css";
import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import { restoreCustomerSession } from './services/session';
createApp(App).use(router).mount("#app");
void restoreCustomerSession();
