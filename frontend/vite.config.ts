/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const API_TARGET = process.env.API_TARGET ?? 'http://localhost:8000'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Cho phép địa chỉ chuyển tiếp cổng của GitHub Codespaces (*.app.github.dev)
    allowedHosts: ['.app.github.dev'],
    proxy: {
      '/api': API_TARGET,
      '/ws': { target: API_TARGET.replace(/^http/, 'ws'), ws: true },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
})
