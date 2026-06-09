import path from 'path'
import fs from 'fs'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import wasm from 'vite-plugin-wasm'
import topLevelAwait from 'vite-plugin-top-level-await'
import type { Plugin } from 'vite'
import pkg from './package.json'

// dev 模式下 opusscript 通过 document.currentScript(ES module 中为 null) 计算路径，
// 导致 WASM 请求根路径 /opusscript_native_wasm.wasm，此中间件补上这个缺失的路由
function serveOpusWasm(): Plugin {
  return {
    name: 'serve-opusscript-wasm',
    apply: 'serve',
    configureServer(server) {
      const wasmPath = path.resolve(
        __dirname,
        'node_modules/opusscript/build/opusscript_native_wasm.wasm',
      )
      server.middlewares.use('/opusscript_native_wasm.wasm', (_req, res) => {
        res.setHeader('Content-Type', 'application/wasm')
        fs.createReadStream(wasmPath).pipe(res)
      })
    },
  }
}

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_NPM_NAME__: JSON.stringify(pkg.name),
  },
  plugins: [react(), tailwindcss(), wasm(), topLevelAwait(), serveOpusWasm()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    include: ['opusscript', 'buffer'],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
  },
})
