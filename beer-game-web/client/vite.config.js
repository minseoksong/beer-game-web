import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // 개발 시 /api/* 요청은 서버(3001)로 프록시
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  }
});
