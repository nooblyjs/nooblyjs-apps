// Playwright (roadmap 0.7): starts the app itself on UI_TEST_PORT with its own data folder, or tests UI_TEST_BASE_URL.
// Results, traces and the report go to .temp/playwright. `npm run test:ui:install` downloads Chromium once.
import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.UI_TEST_PORT ?? 11110);
const baseURL = process.env.UI_TEST_BASE_URL ?? `http://127.0.0.1:${port}`;
// A fresh data folder per run, so sign-ups do not collide with the last run's.
const dataDir = `.temp/playwright/data-${process.env.UI_TEST_RUN ??= String(Date.now())}`;

export default defineConfig({
  testDir: './test/ui',
  outputDir: '.temp/playwright/results',
  reporter: [['list'], ['html', { outputFolder: '.temp/playwright/report', open: 'never' }]],
  timeout: 30_000,
  use: { baseURL, trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'phone', use: { ...devices['Pixel 7'] } },
  ],
  webServer: process.env.UI_TEST_BASE_URL ? undefined : {
    command: 'node app.js',
    url: `${baseURL}/health/live`,
    timeout: 60_000,
    reuseExistingServer: false,
    // The in-process agent: the browser tests check screens, not this machine's Docker.
    env: { PORT: String(port), DATA_DIR: dataDir, PUBLIC_URL: baseURL, NODE_ENV: 'development', HERO_LOCAL_AGENT: 'mock' },
  },
});
