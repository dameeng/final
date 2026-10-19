import {registerPwa} from './runtime/pwa'
import {createApp} from 'vue'
import {createPinia} from 'pinia'
import App from './App.vue'
import router from './router'
import './styles/shared.css'
import './styles/meeting-layout.css'
import './styles/mypage.css'
import './styles/customer-navigation.css'
import './styles/full-width.css'
import './styles/responsive-fixes.css'
import './styles/admin-controls.css'
import './styles/dark-mode.css'
import './styles/admin-header.css'
createApp(App).use(createPinia()).use(router).mount('#app')

registerPwa()
