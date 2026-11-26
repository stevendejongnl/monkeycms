import { defineConfig, devices } from '@playwright/test'

const port = 4173

export default defineConfig({
  testDir: 'src',
  testMatch: '**/*.spec.ts',
  use: { baseURL: `http://127.0.0.1:${port}` },
  webServer: {
    command: `node bin/dist/cli.js serve --port ${port}`,
    url: `http://127.0.0.1:${port}/public/index.html`,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
})
