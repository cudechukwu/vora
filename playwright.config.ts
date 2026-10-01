import { defineConfig } from '@playwright/test';

// Uses the Chrome already installed on this machine (no browser download).
// WebGL runs on SwiftShader so it works headless and in CI.
//
// The tests run against a *built copy* of the game (dist-e2e/, served by `vite preview`), not the
// live dev server: the build is snapshotted when a run starts, so source can keep changing while
// tests run in the background, and a static server is lighter than the dev server.
//
//   npm run test:smoke             ~8 key tests (tagged @smoke), a couple of minutes
//   npm run test:e2e               everything
//   npm run test:e2e -- -g carjack just the tests whose names match
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000, // software WebGL on a busy laptop can render only a few frames a second
  fullyParallel: true,
  workers: 2, // two browsers at once; `-- --workers=1` when the machine is busy
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5189',
    channel: 'chrome',
    viewport: { width: 390, height: 844 }, // iPhone-sized portrait
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] },
  },
  webServer: {
    command: 'npx vite build --outDir dist-e2e --emptyOutDir --logLevel warn && npx vite preview --outDir dist-e2e --port 5189 --strictPort',
    url: 'http://localhost:5189/row.html',
    reuseExistingServer: false, // always a fresh build of the code as it is right now
    timeout: 120_000,
  },
});
