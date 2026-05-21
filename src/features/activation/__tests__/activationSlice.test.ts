import { describe, it, expect, beforeEach } from 'vitest'
import { createActivationSlice, type ActivationState } from '../activationSlice'
import { createStore } from 'zustand/vanilla'

function makeStore() {
  return createStore<ActivationState>()(createActivationSlice)
}

describe('activationSlice', () => {
  let store: ReturnType<typeof makeStore>

  beforeEach(() => {
    store = makeStore()
  })

  it('初始状态应该为 null', () => {
    const state = store.getState()
    expect(state.activationPayload).toBe(null)
  })

  it('setActivation 应该保存激活信息', () => {
    const payload = { message: '设备需要激活，请联系管理员' }
    store.getState().setActivation(payload)
    
    const state = store.getState()
    expect(state.activationPayload).toEqual(payload)
  })

  it('clearActivation 应该清除激活信息', () => {
    const payload = { message: '设备需要激活' }
    store.getState().setActivation(payload)
    
    expect(store.getState().activationPayload).not.toBe(null)
    
    store.getState().clearActivation()
    
    const state = store.getState()
    expect(state.activationPayload).toBe(null)
  })

  it('连续调用 setActivation 应该覆盖旧值', () => {
    const payload1 = { message: '第一次激活提示' }
    const payload2 = { message: '第二次激活提示' }
    
    store.getState().setActivation(payload1)
    expect(store.getState().activationPayload).toEqual(payload1)
    
    store.getState().setActivation(payload2)
    const state = store.getState()
    expect(state.activationPayload).toEqual(payload2)
  })

  it('clearActivation 多次调用应该保持状态为 null', () => {
    store.getState().clearActivation()
    expect(store.getState().activationPayload).toBe(null)
    
    store.getState().clearActivation()
    expect(store.getState().activationPayload).toBe(null)
  })
})
