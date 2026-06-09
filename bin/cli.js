#!/usr/bin/env node

import { createServer } from 'http'
import { readFileSync, statSync, existsSync } from 'fs'
import { join, extname, dirname, relative, isAbsolute } from 'path'
import { fileURLToPath } from 'url'
import { exec } from 'child_process'
import { createConnection } from 'net'

const __dirname = dirname(fileURLToPath(import.meta.url))
const distPath = join(__dirname, '..', 'dist')

const DEFAULT_PORT = 14100

function parseOtaUrl(argv) {
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--ota') {
      return argv[i + 1] || null
    }
    if (arg.startsWith('--ota=')) {
      return arg.slice('--ota='.length) || null
    }
  }
  return null
}

const OTA_URL = parseOtaUrl(process.argv.slice(2))

function parsePort(argv) {
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--port') {
      const v = parseInt(argv[i + 1], 10)
      return isNaN(v) ? null : v
    }
    if (arg.startsWith('--port=')) {
      const v = parseInt(arg.slice('--port='.length), 10)
      return isNaN(v) ? null : v
    }
  }
  return null
}

const SPECIFIED_PORT = parsePort(process.argv.slice(2))

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
  '.webp': 'image/webp',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

function getMimeType(ext) {
  return MIME_TYPES[ext] || 'application/octet-stream'
}

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const conn = createConnection({ port, host: '127.0.0.1' })
    conn.once('connect', () => {
      conn.destroy()
      resolve(false)
    })
    conn.once('error', () => {
      resolve(true)
    })
  })
}

async function findAvailablePort(startPort) {
  let port = startPort
  while (!(await isPortAvailable(port))) {
    port++
  }
  return port
}

function openBrowser(url) {
  const platform = process.platform
  let cmd
  if (platform === 'darwin') {
    cmd = `open "${url}"`
  } else if (platform === 'win32') {
    cmd = `start "" "${url}"`
  } else {
    cmd = `xdg-open "${url}"`
  }
  exec(cmd, (err) => {
    if (err) {
      console.log(`  无法自动打开浏览器，请手动访问: ${url}`)
    }
  })
}

function serveFile(res, filePath) {
  try {
    const content = readFileSync(filePath)
    const ext = extname(filePath).toLowerCase()
    res.writeHead(200, { 'Content-Type': getMimeType(ext) })
    res.end(content)
  } catch {
    res.writeHead(500, { 'Content-Type': 'text/plain' })
    res.end('Internal Server Error')
  }
}

function serveIndexHtml(res) {
  try {
    let html = readFileSync(join(distPath, 'index.html'), 'utf-8')
    if (OTA_URL) {
      const inject = `<script>window.__OTA_URL__ = ${JSON.stringify(OTA_URL)};</script>`
      html = html.replace('</head>', `${inject}</head>`)
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(html)
  } catch {
    res.writeHead(500, { 'Content-Type': 'text/plain' })
    res.end('Internal Server Error')
  }
}

function isSafePath(filePath) {
  const rel = relative(distPath, filePath)
  return !rel.startsWith('..') && !isAbsolute(rel)
}

async function start() {
  if (!existsSync(distPath)) {
    console.error('错误: 未找到 dist/ 目录。')
    console.error('此包不完整或发布有误，请联系发布者重新发布。')
    process.exit(1)
  }

  let port
  try {
    if (SPECIFIED_PORT !== null) {
      const available = await isPortAvailable(SPECIFIED_PORT)
      if (!available) {
        console.error(`错误: 端口 ${SPECIFIED_PORT} 已被占用，请更换端口或省略 --port 参数自动选择。`)
        process.exit(1)
      }
      port = SPECIFIED_PORT
    } else {
      port = await findAvailablePort(DEFAULT_PORT)
    }
  } catch (err) {
    console.error(`错误: 无法确定可用端口: ${err.message}`)
    process.exit(1)
  }

  const url = `http://127.0.0.1:${port}`

  const server = createServer((req, res) => {
    const rawPath = req.url.split('?')[0].split('#')[0]

    let filePath
    try {
      filePath = join(distPath, decodeURIComponent(rawPath))
    } catch {
      res.writeHead(400, { 'Content-Type': 'text/plain' })
      res.end('Bad Request')
      return
    }

    if (!isSafePath(filePath)) {
      res.writeHead(403, { 'Content-Type': 'text/plain' })
      res.end('Forbidden')
      return
    }

    if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
      serveIndexHtml(res)
      return
    }

    if (filePath === join(distPath, 'index.html')) {
      serveIndexHtml(res)
      return
    }

    serveFile(res, filePath)
  })

  server.on('error', (err) => {
    console.error(`错误: HTTP 服务启动失败: ${err.message}`)
    process.exit(1)
  })

  server.listen(port, '0.0.0.0', () => {
    console.log('')
    console.log('  Open Xiaozhi Client')
    console.log('  ─────────────────────────────────')
    console.log(`  本地访问地址: ${url}`)
    console.log(`  正在监听所有网络接口 (0.0.0.0:${port})`)
    if (SPECIFIED_PORT !== null) {
      console.log(`  (端口由 --port 参数指定)`)
    } else if (port !== DEFAULT_PORT) {
      console.log(`  (端口 ${DEFAULT_PORT} 已被占用，自动切换至 ${port})`)
    }
    if (OTA_URL) {
      console.log(`  默认服务地址: ${OTA_URL}`)
    }
    console.log('')
    console.log('  使用方式: 在浏览器中打开上方地址')
    console.log('  退出方式: 按 Ctrl+C')
    console.log('')

    openBrowser(url)
  })

  process.on('SIGINT', () => {
    console.log('\n  正在关闭服务...')
    server.close(() => process.exit(0))
  })

  process.on('SIGTERM', () => {
    server.close(() => process.exit(0))
  })
}

start()
