import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { webcrypto } from 'node:crypto'

// Polyfill for environments where globalThis.crypto is missing or incomplete (Node < 19)
if (!globalThis.crypto || !globalThis.crypto.getRandomValues) {
  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
    writable: true,
    configurable: true
  })
}

export default defineConfig({
  build: {
    minify: false,
    cssMinify: false,
  },
  plugins: [
    react(),
  ],
})
