import '@testing-library/jest-dom'

// jsdom does not implement scrollIntoView
Element.prototype.scrollIntoView = () => {}

// jsdom does not implement ResizeObserver
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

// jsdom reports 0 for layout sizes; provide non-zero defaults so size-driven
// components (e.g. LatencyChart) can render in tests
if (!Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth')?.get) {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 320 })
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 160 })
}
