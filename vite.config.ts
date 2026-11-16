import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/FunFarm/', // Đổi đúng theo tên repo trên GitHub của bạn
})