import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/upload':    { target: 'http://localhost:8000', changeOrigin: true },
      '/stream':    { target: 'http://localhost:8000', changeOrigin: true },
      '/download':  { target: 'http://localhost:8000', changeOrigin: true },
      '/health':    { target: 'http://localhost:8000', changeOrigin: true },
      '/interview': { target: 'http://localhost:8000', changeOrigin: true },
    },
  },
})
