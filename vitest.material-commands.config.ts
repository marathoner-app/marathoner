import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'functions/src/**/*.test.ts',
      'functions/src/**/*.integration.ts',
    ],
    maxWorkers: 1,
    testTimeout: 20_000,
  },
})
