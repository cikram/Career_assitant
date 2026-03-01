import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/upload':    'http://localhost:8000',
      '/stream':    { target: 'http://localhost:8000', changeOrigin: true },
      '/download':  'http://localhost:8000',
      '/health':    'http://localhost:8000',
      '/interview': 'http://localhost:8000',
    },
  },
})
