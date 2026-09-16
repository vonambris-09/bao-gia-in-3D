import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  // Đã bỏ `define: { 'process.env.GEMINI_API_KEY': ... }`.
  // App không dùng Gemini, và để lại thì bất kỳ code nào tham chiếu biến đó
  // sau này sẽ nhúng thẳng API key vào bundle công khai trên GitHub Pages.
  return {
    plugins: [react(), tailwindcss()],
    base: '/bao-gia-in-3D/',
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
