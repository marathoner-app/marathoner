import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach } from 'vitest'

beforeEach(() => {
  if (typeof document === 'undefined') {
    return
  }

  document.documentElement.lang = 'en'
  document.title = 'Marathoner.'
})

afterEach(() => {
  cleanup()
})
