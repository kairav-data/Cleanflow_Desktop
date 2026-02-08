// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // Allow connections from outside the container
    port: 5173,      // Ensure it uses this specific port
    strictPort: true // Fail if the port is already in use instead of picking another
  }
})