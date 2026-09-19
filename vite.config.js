import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/MarianTBI_Monitoring',
  plugins: [react()],
  build: {
    // Split vendor code so app edits don't invalidate the whole 1MB bundle
    // in users' caches, and the initial parse stays bounded.
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage'],
        },
      },
    },
  },
})
