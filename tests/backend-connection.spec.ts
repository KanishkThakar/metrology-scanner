import { test, expect } from '@playwright/test';

const base = process.env.TEST_WEB_URL || 'http://127.0.0.1:3001';

test('keeps photos while a sleeping backend connects', async ({ page }) => {
  await page.route('**/api/health', async route => {
    await new Promise(resolve => setTimeout(resolve, 2500));
    await route.fulfill({ json: { status: 'ONLINE', ocr_engine: 'Tesseract OCR' } });
  });
  await page.addInitScript(() => localStorage.setItem('doca_tour_done', 'true'));
  await page.goto(base);
  await page.locator('#citizenIdentityInput').fill('connection-test@example.com');
  await page.locator('#citizenLoginForm button').click();
  await page.locator('#fileInput').setInputFiles({
    name: 'label.png', mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/Z1sAAAAASUVORK5CYII=', 'base64'),
  });
  await expect(page.locator('#photoList button')).toHaveCount(1);
  await expect(page.locator('#backendStatusPill')).toContainText('Online', { timeout: 15000 });
  await expect(page.locator('#scanButton')).toBeEnabled();
  await expect(page.locator('#photoList button')).toContainText('label.png');
  await expect(page.locator('#statusBar')).not.toContainText('unavailable');
});

test('does not treat a hosting loading page as a healthy OCR API', async ({ page }) => {
  await page.route('**/api/health', route => route.fulfill({
    status: 200, contentType: 'text/html', body: '<html>Starting service...</html>',
  }));
  await page.goto(base);
  await expect(page.locator('#backendStatusPill')).toContainText('Unavailable');
  await expect(page.locator('#scanButton')).toBeDisabled();
});
