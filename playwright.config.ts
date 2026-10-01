import { defineConfig } from '@playwright/test';

// Uses the Chrome already installed on this machine (no browser download).
// WebGL runs on SwiftShader so it works headless and in CI.
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5188',
    channel: 'chrome',
    viewport: { width: 390, height: 844 }, // iPhone-sized portrait
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] },
  },
  webServer: {
    command: 'npx vite --port 5188 --strictPort',
    url: 'http://localhost:5188/row.html',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
