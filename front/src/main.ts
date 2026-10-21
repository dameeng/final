import { registerPwa } from './runtime/pwa'
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import PasswordInput from './components/PasswordInput.vue'
import UiIcon from './components/UiIcon.vue'
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
import './styles/customer-qa.css'
import './styles/customer-responsive.css'
import './styles/customer-map-viewport.css'
import './styles/admin-restored.css'
import './styles/app-restored.css'
import './styles/ui-icons.css'
createApp(App)
  .component('PasswordInput', PasswordInput)
  .component('UiIcon', UiIcon)
  .use(createPinia())
  .use(router)
  .mount('#app')

registerPwa()
