import { defineConfig, devices } from '@playwright/test'

const port = 4173
const demoPort = 4174

export default defineConfig({
  testDir: '.',
  testMatch: ['src/**/*.spec.ts', 'examples/**/*.spec.ts'],
  use: { baseURL: `http://127.0.0.1:${port}` },
  webServer: [
    {
      command: `node bin/dist/cli.js serve --port ${port}`,
      url: `http://127.0.0.1:${port}/public/index.html`,
      reuseExistingServer: !process.env.CI,
    },
    {
      // The demo app with the mock API of the "envelope" example.
      command: `node scripts/demo.mjs envelope --port ${demoPort}`,
      url: `http://127.0.0.1:${demoPort}/`,
      reuseExistingServer: !process.env.CI,
    },
  ],
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
})
