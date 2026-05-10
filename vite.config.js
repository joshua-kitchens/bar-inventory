import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Change this to match your GitHub repo name if it differs from 'bar-inventory'
export default defineConfig({
  plugins: [react()],
  base: '/bar-inventory/',
})
