import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { navigationApi } from './server/navigation-api.mjs'
import { chatApi } from './server/chat-api.mjs'
export default defineConfig(({ mode }) => ({
  plugins: [vue(), chatApi(loadEnv(mode, '.', '')), navigationApi(loadEnv(mode, '.', ''))],
  server: {
    fs: { deny: ['.env', '.env.*', '**/.git/**', '**/.routel-data/**', '**/*.{crt,pem}'] },
    host: 'localhost',
    port: 8282,
    strictPort: true,
    proxy: {
      '/tunnel-source': {
        target: 'https://seoultunnel.co.kr',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/tunnel-source/, '/usage'),
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
      '/tunnel-source': {
        target: 'https://seoultunnel.co.kr',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/tunnel-source/, '/usage'),
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
