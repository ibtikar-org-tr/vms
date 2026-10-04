import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const basePath = env.VITE_BASE_PATH || '/mf/membership-app/'

  return {
    plugins: [react(), tailwindcss()],
    define: {
      global: 'globalThis',
    },
    base: basePath,
    build: {
      outDir: `dist${basePath}`,
    },
    resolve: {
      alias: {
        '@': '/src',
        '@components': '/src/components',
        '@assets': '/src/assets',
        '@public': '/public',
      },
    },
    server: {
      port: 5930,
      proxy: {
        '/ms': {
          target: env.VITE_DEV_API_PROXY || 'http://127.0.0.1:5931',
          changeOrigin: true,
          secure: true,
        },
      },
      watch: {
        usePolling: true,
        interval: 1000,
      },
    },
  }
})
