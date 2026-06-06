import { createContext, useContext, type ReactNode } from 'react'
import type { AppServices } from './createRuntime'

const RuntimeContext = createContext<AppServices | null>(null)

export function RuntimeProvider({ services, children }: { services: AppServices; children: ReactNode }) {
  return <RuntimeContext.Provider value={services}>{children}</RuntimeContext.Provider>
}

export function useAppServices(): AppServices {
  const ctx = useContext(RuntimeContext)
  if (!ctx) throw new Error('useAppServices 必须在 RuntimeProvider 内使用')
  return ctx
}

/** 返回命令分发函数：UI 通过它驱动一切服务器交互。 */
export function useDispatch() {
  return useAppServices().runtime.dispatch.bind(useAppServices().runtime)
}
