import './polyfill'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { createRuntime } from './ui/runtime/createRuntime'
import { RuntimeProvider } from './ui/runtime/RuntimeContext'

document.documentElement.classList.add('dark')

// 组合根：构建运行时（端口 + 状态机编排 + 投影），全局唯一
const services = createRuntime()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RuntimeProvider services={services}>
      <App />
    </RuntimeProvider>
  </StrictMode>,
)
