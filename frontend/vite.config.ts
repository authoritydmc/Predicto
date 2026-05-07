import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  return {
    plugins: [react()],
    define: {
      __APP_ENV__: JSON.stringify(mode),
    },
    server: {
      host: '0.0.0.0', // Allow access from entire LAN
      port: 3456,       // Default port (can be overridden by command line)
      strictPort: false, // Find alternative port if 3456 is taken
      open: false,       // Don't auto-open browser
    },
  }
})
