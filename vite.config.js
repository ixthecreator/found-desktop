import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // 部署在GitHub Pages的/found-desktop/下面；资源地址都得带上这个前缀；
  // 本地开发也是这个路径，打开http://localhost:5173/found-desktop/
  base: '/found-desktop/',
  plugins: [react()], // JSX、热更新
})
