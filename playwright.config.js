import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  retries: 1,
  use: {
    baseURL: 'http://localhost:8086',
    headless: true
  },
  webServer: {
    command: 'npm run dev',
    port: 8086,
    reuseExistingServer: true,
    timeout: 120000
  }
})
