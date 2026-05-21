import { describe, it, expect, beforeEach } from 'vitest'
import { createDeviceIdentitySlice, type DeviceIdentityState } from '../deviceIdentitySlice'
import { createStore } from 'zustand/vanilla'
import { STORAGE_KEYS } from '../../../lib/persistence'

function makeStore() {
  return createStore<DeviceIdentityState>()(createDeviceIdentitySlice)
}

describe('deviceIdentitySlice 初始化与持久化', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('首次启动时生成随机 MAC 格式 deviceId 并持久化', () => {
    const store = makeStore()
    const deviceId = store.getState().deviceId
    
    expect(deviceId).toMatch(/^[0-9A-F]{2}:[0-9A-F]{2}:[0-9A-F]{2}:[0-9A-F]{2}:[0-9A-F]{2}:[0-9A-F]{2}$/)
    
    const saved = localStorage.getItem(STORAGE_KEYS.DEVICE_ID)
    expect(saved).toBe(deviceId)
  })

  it('存在持久化 deviceId 时加载已保存的值', () => {
    localStorage.setItem(STORAGE_KEYS.DEVICE_ID, 'AA:BB:CC:DD:EE:FF')
    const store = makeStore()
    
    expect(store.getState().deviceId).toBe('AA:BB:CC:DD:EE:FF')
  })

  it('生成的 deviceId 每次启动保持一致（不重复生成）', () => {
    const store1 = makeStore()
    const id1 = store1.getState().deviceId
    
    const store2 = makeStore()
    const id2 = store2.getState().deviceId
    
    expect(id1).toBe(id2)
  })
})

describe('deviceIdentitySlice 编辑流程', () => {
  let store: ReturnType<typeof makeStore>
  
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem(STORAGE_KEYS.DEVICE_ID, '11:22:33:44:55:66')
    store = makeStore()
  })

  it('初始状态不处于编辑模式', () => {
    expect(store.getState().isEditing).toBe(false)
    expect(store.getState().editDraft).toBe('')
  })

  it('startEdit 进入编辑模式并填充当前 deviceId 到 draft', () => {
    store.getState().startEdit()
    
    expect(store.getState().isEditing).toBe(true)
    expect(store.getState().editDraft).toBe('11:22:33:44:55:66')
  })

  it('setEditDraft 更新草稿值', () => {
    store.getState().startEdit()
    store.getState().setEditDraft('AA:BB:CC:DD:EE:FF')
    
    expect(store.getState().editDraft).toBe('AA:BB:CC:DD:EE:FF')
    expect(store.getState().deviceId).toBe('11:22:33:44:55:66') // 原值不变
  })

  it('saveEdit 提交草稿，更新 deviceId 并持久化，退出编辑模式', () => {
    store.getState().startEdit()
    store.getState().setEditDraft('FF:EE:DD:CC:BB:AA')
    store.getState().saveEdit()
    
    expect(store.getState().deviceId).toBe('FF:EE:DD:CC:BB:AA')
    expect(store.getState().isEditing).toBe(false)
    expect(store.getState().editDraft).toBe('')
    
    const saved = localStorage.getItem(STORAGE_KEYS.DEVICE_ID)
    expect(saved).toBe('FF:EE:DD:CC:BB:AA')
  })

  it('cancelEdit 取消编辑，草稿清空，退出编辑模式', () => {
    store.getState().startEdit()
    store.getState().setEditDraft('XX:YY:ZZ:00:11:22')
    store.getState().cancelEdit()
    
    expect(store.getState().deviceId).toBe('11:22:33:44:55:66') // 不变
    expect(store.getState().isEditing).toBe(false)
    expect(store.getState().editDraft).toBe('')
  })

  it('randomizeDeviceId 生成新随机 ID 并持久化', () => {
    const oldId = store.getState().deviceId
    store.getState().randomizeDeviceId()
    
    const newId = store.getState().deviceId
    expect(newId).not.toBe(oldId)
    expect(newId).toMatch(/^[0-9A-F]{2}:[0-9A-F]{2}:[0-9A-F]{2}:[0-9A-F]{2}:[0-9A-F]{2}:[0-9A-F]{2}$/)
    
    const saved = localStorage.getItem(STORAGE_KEYS.DEVICE_ID)
    expect(saved).toBe(newId)
  })
})

describe('deviceIdentitySlice 输入验证', () => {
  let store: ReturnType<typeof makeStore>
  
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem(STORAGE_KEYS.DEVICE_ID, '11:22:33:44:55:66')
    store = makeStore()
  })

  it('saveEdit 拒绝空字符串，保持原值', () => {
    store.getState().startEdit()
    store.getState().setEditDraft('')
    store.getState().saveEdit()
    
    expect(store.getState().deviceId).toBe('11:22:33:44:55:66') // 原值不变
    expect(store.getState().isEditing).toBe(true) // 仍在编辑模式
    
    const saved = localStorage.getItem(STORAGE_KEYS.DEVICE_ID)
    expect(saved).toBe('11:22:33:44:55:66') // 持久化未改变
  })

  it('saveEdit 拒绝纯空格，保持原值', () => {
    store.getState().startEdit()
    store.getState().setEditDraft('   ')
    store.getState().saveEdit()
    
    expect(store.getState().deviceId).toBe('11:22:33:44:55:66')
    expect(store.getState().isEditing).toBe(true)
    
    const saved = localStorage.getItem(STORAGE_KEYS.DEVICE_ID)
    expect(saved).toBe('11:22:33:44:55:66')
  })

  it('saveEdit 拒绝制表符和换行符，保持原值', () => {
    store.getState().startEdit()
    store.getState().setEditDraft('\t\n  ')
    store.getState().saveEdit()
    
    expect(store.getState().deviceId).toBe('11:22:33:44:55:66')
    expect(store.getState().isEditing).toBe(true)
  })

  it('saveEdit 接受有效的非空输入', () => {
    store.getState().startEdit()
    store.getState().setEditDraft('AA:BB:CC:DD:EE:FF')
    store.getState().saveEdit()
    
    expect(store.getState().deviceId).toBe('AA:BB:CC:DD:EE:FF')
    expect(store.getState().isEditing).toBe(false)
    
    const saved = localStorage.getItem(STORAGE_KEYS.DEVICE_ID)
    expect(saved).toBe('AA:BB:CC:DD:EE:FF')
  })
})
