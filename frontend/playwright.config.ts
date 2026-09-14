import { defineConfig, devices } from '@playwright/test';

const LOCAL_UI = 'http://127.0.0.1:5173';

// El harness solo habla con la UI local; nunca con un host remoto.
export default defineConfig({
  testDir: './tests/e2e',
  outputDir: './test-results',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: LOCAL_UI,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'simulated',
      metadata: { provider: 'simulated' },
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'real',
      metadata: { provider: 'real' },
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: LOCAL_UI,
    reuseExistingServer: !process.env.CI,
    stdout: 'ignore',
    stderr: 'pipe',
    timeout: 120_000,
  },
});
