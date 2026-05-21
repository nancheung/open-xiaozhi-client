import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConnectionHeader } from '../ConnectionHeader'
import { useStore } from '../../store'
import type { ConnectionStatus } from '../../features/connection/connectionSlice'

// Mock the useConnection hook
vi.mock('../../hooks/useConnection', () => ({
  useConnection: () => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
  }),
}))

function setupStore(overrides: {
  deviceId?: string
  isEditing?: boolean
  editDraft?: string
  status?: ConnectionStatus
}) {
  const state = useStore.getState()
  
  if (overrides.deviceId !== undefined) {
    useStore.setState({ deviceId: overrides.deviceId })
  }
  if (overrides.isEditing !== undefined) {
    useStore.setState({ isEditing: overrides.isEditing })
  }
  if (overrides.editDraft !== undefined) {
    useStore.setState({ editDraft: overrides.editDraft })
  }
  if (overrides.status !== undefined) {
    state.setStatus(overrides.status)
  }
}

describe('ConnectionHeader 设备 ID 显示', () => {
  beforeEach(() => {
    localStorage.clear()
    useStore.setState({
      deviceId: 'AA:BB:CC:DD:EE:FF',
      isEditing: false,
      editDraft: '',
      status: 'idle',
    })
  })

  it('默认显示只读的设备 ID', () => {
    setupStore({ deviceId: 'AA:BB:CC:DD:EE:FF', isEditing: false, status: 'idle' })
    render(<ConnectionHeader />)
    
    expect(screen.getByText('AA:BB:CC:DD:EE:FF')).toBeInTheDocument()
    expect(screen.queryByDisplayValue('AA:BB:CC:DD:EE:FF')).not.toBeInTheDocument()
  })

  it('显示"随机刷新"和"编辑"按钮', () => {
    setupStore({ status: 'idle' })
    render(<ConnectionHeader />)
    
    expect(screen.getByRole('button', { name: /随机刷新/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /编辑/i })).toBeInTheDocument()
  })
})

describe('ConnectionHeader 编辑流程', () => {
  beforeEach(() => {
    localStorage.clear()
    useStore.setState({
      deviceId: '11:22:33:44:55:66',
      isEditing: false,
      editDraft: '',
      status: 'idle',
    })
  })

  it('点击"编辑"按钮进入编辑模式', async () => {
    setupStore({ deviceId: '11:22:33:44:55:66', isEditing: false, status: 'idle' })
    render(<ConnectionHeader />)
    
    const editBtn = screen.getByRole('button', { name: /编辑/i })
    await userEvent.click(editBtn)
    
    const state = useStore.getState()
    expect(state.isEditing).toBe(true)
    expect(state.editDraft).toBe('11:22:33:44:55:66')
  })

  it('编辑模式下显示输入框和"保存""取消"按钮', () => {
    setupStore({ deviceId: '11:22:33:44:55:66', isEditing: true, editDraft: '11:22:33:44:55:66', status: 'idle' })
    render(<ConnectionHeader />)
    
    expect(screen.getByDisplayValue('11:22:33:44:55:66')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /保存/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /取消/i })).toBeInTheDocument()
    
    expect(screen.queryByRole('button', { name: /随机刷新/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /编辑/i })).not.toBeInTheDocument()
  })

  it('可以在输入框中修改设备 ID', async () => {
    setupStore({ deviceId: '11:22:33:44:55:66', isEditing: true, editDraft: '11:22:33:44:55:66', status: 'idle' })
    render(<ConnectionHeader />)
    
    const input = screen.getByDisplayValue('11:22:33:44:55:66')
    await userEvent.clear(input)
    await userEvent.type(input, 'AA:BB:CC:DD:EE:FF')
    
    const state = useStore.getState()
    expect(state.editDraft).toBe('AA:BB:CC:DD:EE:FF')
  })

  it('点击"保存"按钮提交修改并退出编辑模式', async () => {
    setupStore({ deviceId: '11:22:33:44:55:66', isEditing: true, editDraft: 'FF:EE:DD:CC:BB:AA', status: 'idle' })
    render(<ConnectionHeader />)
    
    const saveBtn = screen.getByRole('button', { name: /保存/i })
    await userEvent.click(saveBtn)
    
    const state = useStore.getState()
    expect(state.deviceId).toBe('FF:EE:DD:CC:BB:AA')
    expect(state.isEditing).toBe(false)
  })

  it('点击"取消"按钮放弃修改并退出编辑模式', async () => {
    setupStore({ deviceId: '11:22:33:44:55:66', isEditing: true, editDraft: 'XX:YY:ZZ:00:11:22', status: 'idle' })
    render(<ConnectionHeader />)
    
    const cancelBtn = screen.getByRole('button', { name: /取消/i })
    await userEvent.click(cancelBtn)
    
    const state = useStore.getState()
    expect(state.deviceId).toBe('11:22:33:44:55:66')
    expect(state.isEditing).toBe(false)
  })

  it('点击"随机刷新"按钮生成新的随机设备 ID', async () => {
    setupStore({ deviceId: '11:22:33:44:55:66', isEditing: false, status: 'idle' })
    render(<ConnectionHeader />)
    
    const randomBtn = screen.getByRole('button', { name: /随机刷新/i })
    await userEvent.click(randomBtn)
    
    const state = useStore.getState()
    expect(state.deviceId).not.toBe('11:22:33:44:55:66')
    expect(state.deviceId).toMatch(/^[0-9A-F]{2}:[0-9A-F]{2}:[0-9A-F]{2}:[0-9A-F]{2}:[0-9A-F]{2}:[0-9A-F]{2}$/)
  })
})

describe('ConnectionHeader 按钮禁用逻辑', () => {
  beforeEach(() => {
    localStorage.clear()
    useStore.setState({
      deviceId: 'AA:BB:CC:DD:EE:FF',
      isEditing: false,
      editDraft: '',
    })
  })

  it('连接中时禁用"随机刷新"和"编辑"按钮', () => {
    setupStore({ status: 'ws_connecting' })
    render(<ConnectionHeader />)
    
    expect(screen.getByRole('button', { name: /随机刷新/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /编辑/i })).toBeDisabled()
  })

  it('已连接时禁用"随机刷新"和"编辑"按钮', () => {
    setupStore({ status: 'ready' })
    render(<ConnectionHeader />)
    
    expect(screen.getByRole('button', { name: /随机刷新/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /编辑/i })).toBeDisabled()
  })

  it('idle 状态时启用"随机刷新"和"编辑"按钮', () => {
    setupStore({ status: 'idle' })
    render(<ConnectionHeader />)
    
    expect(screen.getByRole('button', { name: /随机刷新/i })).not.toBeDisabled()
    expect(screen.getByRole('button', { name: /编辑/i })).not.toBeDisabled()
  })

  it('error 状态时启用"随机刷新"和"编辑"按钮', () => {
    setupStore({ status: 'error' })
    render(<ConnectionHeader />)
    
    expect(screen.getByRole('button', { name: /随机刷新/i })).not.toBeDisabled()
    expect(screen.getByRole('button', { name: /编辑/i })).not.toBeDisabled()
  })
})

describe('ConnectionHeader 连接状态区分', () => {
  beforeEach(() => {
    localStorage.clear()
    useStore.setState({
      deviceId: 'AA:BB:CC:DD:EE:FF',
      isEditing: false,
      editDraft: '',
    })
  })

  it('ready 状态应该被视为已连接', () => {
    setupStore({ status: 'ready' })
    render(<ConnectionHeader />)
    
    const connectBtn = screen.getByRole('button', { name: /断开/i })
    expect(connectBtn).toBeInTheDocument()
  })

  it('listening 状态应该被视为已连接', () => {
    setupStore({ status: 'listening' })
    render(<ConnectionHeader />)
    
    const connectBtn = screen.getByRole('button', { name: /断开/i })
    expect(connectBtn).toBeInTheDocument()
  })

  it('playing 状态应该被视为已连接', () => {
    setupStore({ status: 'playing' })
    render(<ConnectionHeader />)
    
    const connectBtn = screen.getByRole('button', { name: /断开/i })
    expect(connectBtn).toBeInTheDocument()
  })

  it('ws_connecting 状态应该被视为连接中而非已连接', () => {
    setupStore({ status: 'ws_connecting' })
    render(<ConnectionHeader />)
    
    const connectBtn = screen.getByRole('button', { name: /连接中.../i })
    expect(connectBtn).toBeInTheDocument()
    expect(connectBtn).toBeDisabled()
  })

  it('handshaking 状态应该被视为连接中而非已连接', () => {
    setupStore({ status: 'handshaking' })
    render(<ConnectionHeader />)
    
    const connectBtn = screen.getByRole('button', { name: /连接中.../i })
    expect(connectBtn).toBeInTheDocument()
    expect(connectBtn).toBeDisabled()
  })

  it('mcp_init 状态应该被视为连接中而非已连接', () => {
    setupStore({ status: 'mcp_init' })
    render(<ConnectionHeader />)
    
    const connectBtn = screen.getByRole('button', { name: /连接中.../i })
    expect(connectBtn).toBeInTheDocument()
    expect(connectBtn).toBeDisabled()
  })

  it('ota_fetching 状态应该被视为连接中而非已连接', () => {
    setupStore({ status: 'ota_fetching' })
    render(<ConnectionHeader />)
    
    const connectBtn = screen.getByRole('button', { name: /连接中.../i })
    expect(connectBtn).toBeInTheDocument()
    expect(connectBtn).toBeDisabled()
  })
})

describe('ConnectionHeader 激活状态', () => {
  beforeEach(() => {
    localStorage.clear()
    useStore.setState({
      deviceId: 'AA:BB:CC:DD:EE:FF',
      isEditing: false,
      editDraft: '',
      status: 'idle',
    })
  })

  it('显示"待激活"状态标签', () => {
    setupStore({ status: 'activation_required' })
    render(<ConnectionHeader />)
    
    expect(screen.getByText('待激活')).toBeInTheDocument()
  })

  it('点击"随机刷新"按钮应该清除激活状态和连接状态', async () => {
    const clearActivation = vi.fn()
    const reset = vi.fn()
    
    useStore.setState({
      status: 'activation_required',
      activationPayload: { message: '需要激活' },
      clearActivation,
      reset,
    })
    
    setupStore({ status: 'activation_required' })
    render(<ConnectionHeader />)
    
    const randomBtn = screen.getByRole('button', { name: /随机刷新/i })
    await userEvent.click(randomBtn)
    
    // Should clear activation and reset connection
    expect(clearActivation).toHaveBeenCalled()
    expect(reset).toHaveBeenCalled()
  })

  it('点击"保存"按钮应该清除激活状态和连接状态', async () => {
    const clearActivation = vi.fn()
    const reset = vi.fn()
    
    useStore.setState({
      deviceId: 'AA:BB:CC:DD:EE:FF',
      isEditing: true,
      editDraft: 'FF:EE:DD:CC:BB:AA',
      status: 'activation_required',
      activationPayload: { message: '需要激活' },
      clearActivation,
      reset,
    })
    
    render(<ConnectionHeader />)
    
    const saveBtn = screen.getByRole('button', { name: /保存/i })
    await userEvent.click(saveBtn)
    
    // Should clear activation and reset connection
    expect(clearActivation).toHaveBeenCalled()
    expect(reset).toHaveBeenCalled()
  })

  it('保存空白设备 ID 时不应清除激活状态和连接状态', async () => {
    const clearActivation = vi.fn()
    const reset = vi.fn()
    
    useStore.setState({
      deviceId: 'AA:BB:CC:DD:EE:FF',
      isEditing: true,
      editDraft: '   ',  // whitespace-only draft
      status: 'activation_required',
      activationPayload: { message: '需要激活' },
      clearActivation,
      reset,
    })
    
    render(<ConnectionHeader />)
    
    const saveBtn = screen.getByRole('button', { name: /保存/i })
    await userEvent.click(saveBtn)
    
    // Should NOT clear activation or reset when save is rejected
    expect(clearActivation).not.toHaveBeenCalled()
    expect(reset).not.toHaveBeenCalled()
    
    // Device ID should remain unchanged
    const state = useStore.getState()
    expect(state.deviceId).toBe('AA:BB:CC:DD:EE:FF')
  })
})
