import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'

configure({ asyncUtilTimeout: 3_000 })

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  window.location.hash = ''
  window.scrollTo = vi.fn()
  window.confirm = vi.fn(() => true)
  URL.createObjectURL = vi.fn(() => 'blob:demo-report')
  URL.revokeObjectURL = vi.fn()
})
afterEach(() => {
  cleanup()
})
