import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/',
  // `npm run serve` in another terminal provides the API during `npm run dev`.
  server: { proxy: { '/api': 'http://127.0.0.1:3006' } },
})
