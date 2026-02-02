import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // 設定為相對路徑 './' 讓 GitHub Pages 可以正確讀取資源
  // 無論你的儲存庫名稱是什麼，這通常都能運作
  base: './', 
})