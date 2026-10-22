import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { navigationApi } from './server/navigation-api.mjs'
export default defineConfig(({ mode }) => ({
  plugins: [vue(), navigationApi(loadEnv(mode, '.', ''))],
  server: {
    host: 'localhost',
    port: 8282,
    strictPort: true,
    proxy: {
      '/control/plate': {
        target: loadEnv(mode, '.', '').AI_SERVER_URL || 'http://localhost:8000',
        changeOrigin: true,
        headers: { 'X-Internal-Api-Key': loadEnv(mode, '.', '').INTERNAL_API_KEY || '' },
      },
      '/api': {
        target: loadEnv(mode, '.', '').BACKEND_URL || 'http://localhost:5555',
        changeOrigin: true,
        timeout: 0,
        proxyTimeout: 0,
      },
    },
  },
  preview: {
    host: 'localhost',
    port: 8282,
    strictPort: true,
    proxy: {
      '/control/plate': {
        target: loadEnv(mode, '.', '').AI_SERVER_URL || 'http://localhost:8000',
        changeOrigin: true,
        headers: { 'X-Internal-Api-Key': loadEnv(mode, '.', '').INTERNAL_API_KEY || '' },
      },
      '/api': {
        target: loadEnv(mode, '.', '').BACKEND_URL || 'http://localhost:5555',
        changeOrigin: true,
        timeout: 0,
        proxyTimeout: 0,
      },
    },
  },
}))
