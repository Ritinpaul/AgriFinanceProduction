import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      // Whether to polyfill `node:` protocol imports.
      protocolImports: true,
    }),
  ],
  define: {
    global: 'globalThis',
  },
  server: {
    port: 3000,
    strictPort: true,
    host: '0.0.0.0',
    allowedHosts: ['localhost', '51e46684-e9cb-4dd6-9c5c-805bb29968aa.preview.emergentagent.com', '.emergentagent.com', '.emergent.host'],
    hmr: {
      port: 3000,
      host: '0.0.0.0'
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
        ws: false,
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  },
  optimizeDeps: {
    include: ['@biconomy/account', '@biconomy/bundler', '@biconomy/paymaster', 'viem', 'viem/chains', 'viem/accounts'],
    exclude: []
  },
  resolve: {
    alias: {
      'viem': 'viem',
      'viem/chains': 'viem/chains',
      'viem/accounts': 'viem/accounts'
    }
  }
})