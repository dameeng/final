import { defineConfig,loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import {navigationApi} from './server/navigation-api.mjs'
export default defineConfig(({mode})=>({
  plugins: [vue(),navigationApi(loadEnv(mode,'.',''))],
  server: { host: 'localhost', port: 8282, strictPort: true,proxy:{'/api':{target:loadEnv(mode,'.','').BACKEND_URL||'http://localhost:5555',changeOrigin:true}} },
  preview: { host: 'localhost', port: 8282, strictPort: true,proxy:{'/api':{target:loadEnv(mode,'.','').BACKEND_URL||'http://localhost:5555',changeOrigin:true}} },
}))
