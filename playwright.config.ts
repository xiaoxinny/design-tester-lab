import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  retries: 2,
  workers: 1,
  use: {
    baseURL: 'http://localhost:3030',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'pnpm dev',
    port: 3030,
    reuseExistingServer: !process.env.CI,
    env: {
      ENCRYPTION_KEY: 'Do0XikEiaBogQbx07NiQ86mXKhK85QGLmOTDF3+BKBA=',
      SESSION_SECRET: '0QnpGKbksOW9x8RDRn8OD2G+tR9SDNypW2YPoXSBKM8=',
      NODE_ENV: 'development',
    },
  },
})