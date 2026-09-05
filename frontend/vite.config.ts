import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // relative asset URLs so the bundle works under any hosting path prefix
  base: './',
  plugins: [react()],
})
