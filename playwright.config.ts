import { defineConfig } from '@playwright/test';
export default defineConfig({testDir:'./tests',testMatch:'*.spec.ts',workers:1,retries:0,outputDir:'work/playwright-results',use:{browserName:'chromium',headless:true,viewport:{width:1440,height:1000},trace:'retain-on-failure'}});
