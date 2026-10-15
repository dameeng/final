import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

const entry = (path: string) => fileURLToPath(new URL(path, import.meta.url))

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      filename: 'app-sw.js',
      manifestFilename: 'app.webmanifest',
      scope: '/app/',
      manifest: {
        id: '/app/',
        name: 'ROUTEL 고객 앱',
        short_name: 'ROUTEL',
        lang: 'ko',
        start_url: '/app/',
        scope: '/app/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#ffffff',
        icons: [
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: { navigateFallbackDenylist: [/^\/api/], cleanupOutdatedCaches: true },
    }),
  ],
  build: {
    rollupOptions: {
      input: { customer: entry('./index.html'), app: entry('./app/index.html'), manager: entry('./manager/index.html'), demo: entry('./demo/index.html') },
    },
  },
  server: {
    port: 8282,
    strictPort: true,
    proxy: {
      '/api': { target: process.env.ROUTEL_BACKEND_URL || 'http://localhost:5555', changeOrigin: true },
      // AI 서버(FastAPI): /ai/stream/1 -> http://localhost:8000/stream/1 (CCTV 실시간 탐지 영상)
      // localhost 로 두면 Node가 IPv6(::1)로 먼저 붙는데 uvicorn(0.0.0.0)은 IPv4만 받아서 시간 초과 -> 127.0.0.1 로 고정
      // 재생/정지 버튼(/ai/control/plate/start|stop)에 필요한 키는 브라우저 코드에 넣지 않고 개발 서버가 붙임 (FastAPI config.INTERNAL_API_KEY 와 같은 값)
      '/ai': { target: process.env.ROUTEL_AI_URL || 'http://127.0.0.1:8000', changeOrigin: true, rewrite: (path) => path.replace(/^\/ai/, ''),
               headers: { 'X-Internal-Api-Key': process.env.ROUTEL_INTERNAL_KEY || 'dev-internal-key-change-me' } },
    },
  },
  preview: { port: 8282, strictPort: true },
})