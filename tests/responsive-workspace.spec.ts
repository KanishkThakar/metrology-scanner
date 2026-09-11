import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const web = process.env.TEST_WEB_URL || 'http://127.0.0.1:3001';
const api = process.env.TEST_API_URL || 'http://127.0.0.1:8000';
test.use({ actionTimeout: 15000, browserName: process.env.TEST_BROWSER === 'webkit' ? 'webkit' : 'chromium' });

async function fits(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(await page.evaluate(() => innerWidth));
  for (const selector of ['.app-nav', '#guideStepUpload', '#guideStepAudit', '.mobile-dock']) {
    const element = page.locator(selector);
    if (await element.isVisible()) {
      const box = (await element.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual((page.viewportSize()?.width || 0) + 1);
    }
  }
}

async function signIn(page: Page) {
  await page.addInitScript(() => localStorage.setItem('doca_tour_done', 'true'));
  await page.goto(web);
  await page.getByLabel('Mobile Number or Email', { exact: true }).fill('responsive-review@example.com');
  await page.getByRole('button', { name: 'Enter Citizen Mode', exact: true }).click();
  await expect(page.locator('#roleGatewayModal')).toBeHidden();
}

test('phone, tablet and desktop layouts keep controls on screen', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  for (const width of [320, 360, 390, 430, 768, 1280, 1440]) {
    await page.setViewportSize({ width, height: width < 700 ? 844 : 1000 });
    await fits(page);
    await page.locator('#scanSettings > summary').click();
    for (const id of ['categoryFilter', 'stateDropdown', 'districtDropdown', 'pincodeInput', 'packageArea']) {
      const box = (await page.locator('#' + id).boundingBox())!;
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      expect(box.height, `${id} at ${width}px`).toBeGreaterThanOrEqual(44);
    }
    await page.locator('#scanSettings > summary').click();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#mobileToolsBtn').click();
  await page.locator('#languageSelector').selectOption('hi');
  await page.locator('#themeToggleBtn').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await fits(page);
  await page.locator('#viewRulesBtn').click();
  await expect(page.locator('#rulesModal')).toBeVisible();
  await expect(page.locator('#navControls')).toBeHidden();
  await page.locator('#closeRulesModal').click();
  await page.locator('#mobileToolsBtn').click();
  await page.locator('#languageSelector').selectOption('en');
  await page.locator('#themeToggleBtn').click();
  await page.locator('#mobileToolsBtn').click();
  await page.locator('#hamburgerBtn').click();
  await expect(page.locator('#sideDrawer')).toHaveClass(/open/);
  await page.locator('#sideDrawer a[href="#workspace"]').click();
  await expect(page.locator('#sideDrawer')).not.toHaveClass(/open/);
  await page.locator('#mobileAdvisorBtn').click();
  await expect(page.locator('#aiChatWindow')).toBeVisible();
  await fits(page);
  await page.locator('#chatCloseBtn').click();
  await expect(page.locator('#mobileAdvisorBtn')).toHaveAttribute('aria-expanded', 'false');
  await page.locator('.mobile-dock a[href="#guideStepAudit"]').click();
  await expect(page.locator('.mobile-dock a[href="#guideStepAudit"]')).toHaveClass(/active/);
  await page.locator('.mobile-dock a[href="#guideStepUpload"]').click();
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: 'work/mobile-workspace-light.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('phone scan uploads multiple photos and keeps results, PDF, and advisor usable', async ({ page, request }) => {
  test.setTimeout(240000);
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  await expect(page.locator('#backendStatusPill')).toContainText('Online', { timeout: 100000 });
  await page.locator('#fileInput').setInputFiles([
    {name:'front-of-package-with-a-very-long-filename-2026-09-11.jpg',mimeType:'image/jpeg',buffer:readFileSync(path.resolve('work/side-1.jpg'))},
    {name:'back-of-package.jpg',mimeType:'image/jpeg',buffer:readFileSync(path.resolve('work/side-2.jpg'))},
  ]);
  await expect(page.locator('#photoList button')).toHaveCount(2);
  await expect(page.locator('#photoCount')).toHaveText('2 / 8');
  await fits(page);
  const response = page.waitForResponse(r => r.url() === api + '/api/scan' && r.request().method() === 'POST');
  await page.locator('#scanButton').click();
  const http = await response;
  expect(http.status()).toBe(200);
  const scan = await http.json();
  expect(scan.photo_count).toBe(2);
  expect(scan.ocr_engine).toBe('hybrid');
  await expect(page.locator('#statusBar')).toContainText('Audit complete');
  await expect(page.locator('#rulesList .rule-card')).toHaveCount(Object.keys(scan.rules).length);
  await fits(page);
  const pdf = await request.get(api + scan.report_pdf_url);
  expect((await pdf.body()).subarray(0, 4).toString()).toBe('%PDF');
  await page.locator('#fileComplaintBtn').click();
  await expect(page.locator('#dispatchNoticeModal')).toBeVisible();
  await page.locator('#closeDispatchModal').click();
  await page.locator('#mobileAdvisorBtn').click();
  await page.locator('#chatTextInput').fill('Cooling charges above MRP');
  await page.locator('#chatSendBtn').click();
  await expect(page.locator('#chatMessages .ai').last()).toContainText('MRP');
  await page.locator('#chatCloseBtn').click();
  await page.locator('#guideStepAudit').scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'work/mobile-workspace-results.png' });
  await page.locator('#mobileToolsBtn').click();
  await page.locator('#themeToggleBtn').click();
  await page.locator('#mobileToolsBtn').click();
  await page.screenshot({ path: 'work/mobile-workspace-dark.png' });
});
