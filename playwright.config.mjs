import {defineConfig,devices} from '@playwright/test';

export default defineConfig({
  testDir:'./tests/e2e',
  timeout:90_000,
  expect:{timeout:15_000},
  fullyParallel:false,
  workers:1,
  retries:process.env.CI?1:0,
  reporter:process.env.CI?[['line'],['html',{outputFolder:'playwright-report',open:'never'}]]:'line',
  use:{
    baseURL:process.env.VORLEN_E2E_BASE_URL||'https://www.vorlen.co.uk',
    trace:'retain-on-failure',
    screenshot:'only-on-failure',
    video:'retain-on-failure',
    actionTimeout:15_000,
    navigationTimeout:30_000
  },
  projects:[{name:'chromium',use:{...devices['Desktop Chrome']}}]
});
