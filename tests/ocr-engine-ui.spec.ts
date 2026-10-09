import { test, expect, type Page } from '@playwright/test';

const web = process.env.TEST_WEB_URL || 'http://127.0.0.1:3001';
// One generated pixel is enough for upload/transport tests, never OCR accuracy.
const image = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNg+A8AAQIBAEK+vGgAAAAASUVORK5CYII=',
  'base64',
);
const modes = ['paddleocr', 'tesseract', 'hybrid'];

async function enterScanner(page: Page) {
  // Keep the suite local and free of OCR runtimes, provider keys, and databases.
  await page.route('**/api/**', route => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === '/api/health') {
      return route.fulfill({ json: { status: 'ONLINE', ocr_engine: 'Mock transport test' } });
    }
    if (pathname === '/api/inspections') return route.fulfill({ json: [] });
    return route.fulfill({ status: 503, json: { detail: 'Not used by the OCR UI test.' } });
  });
  await page.addInitScript(() => localStorage.setItem('doca_tour_done', 'true'));
  await page.goto(web);
  await expect(page.locator('#backendStatusPill')).toContainText('Online');
  await page.locator('#citizenIdentityInput').fill('ocr-ui-test@example.com');
  await page.locator('#citizenLoginForm button').click();
  await expect(page.locator('#roleGatewayModal')).toBeHidden();
}

test('OCR selection survives reload and all modes send the same photo', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await enterScanner(page);
  await expect(page.locator('[data-ocr-engine]')).toHaveCount(3);
  await expect(page.locator('#hybridOcrBtn')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#tesseractOcrBtn').click();
  await page.reload();
  await expect(page.locator('#tesseractOcrBtn')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#citizenIdentityInput').fill('ocr-ui-test@example.com');
  await page.locator('#citizenLoginForm button').click();
  await expect(page.locator('#roleGatewayModal')).toBeHidden();
  await expect(page.locator('#backendStatusPill')).toContainText('Online');
  await page.locator('#fileInput').setInputFiles({ name: 'label.png', mimeType: 'image/png', buffer: image });
  await page.route('**/__test__/label.png', route => route.fulfill({ contentType: 'image/png', body: image }));

  for (const [index, mode] of modes.entries()) {
    let releaseResponse!: () => void;
    const gate = new Promise<void>(resolve => { releaseResponse = resolve; });
    await page.route('**/api/scan', async route => {
      await gate;
      return route.fulfill({ json: {
        inspection_id: index + 1, ocr_engine: mode, image_url: '/__test__/label.png',
        is_compliant: false, compliance_status: 'REVIEW', total_violations: 0,
        brand: 'Synthetic UI fixture', timestamp: '2026-01-01T00:00:00',
        rules: { mrp: { key: 'mrp', status: 'REVIEW', detected_value: 'Simulated OCR response' } },
      } });
    });
    await page.locator('[data-ocr-engine="' + mode + '"]').click();
    const pending = page.waitForRequest(request => new URL(request.url()).pathname === '/api/scan' && request.method() === 'POST');
    await page.locator('#scanButton').click();
    const request = await pending;
    try {
      await expect(page.locator('#scanButton')).toBeDisabled();
      for (const choice of modes) {
        await expect(page.locator('[data-ocr-engine="' + choice + '"]')).toBeDisabled();
      }
      const form = await new Response(new Uint8Array(request.postDataBuffer()!), {
        headers: { 'Content-Type': request.headers()['content-type'] },
      }).formData();
      expect(form.get('ocr_engine')).toBe(mode);
      expect(form.getAll('files')).toHaveLength(1);
      const photo = form.get('files') as File;
      expect(photo.name).toBe('label.png');
      expect(Buffer.from(await photo.arrayBuffer())).toEqual(image);
    } finally {
      releaseResponse();
    }
    await expect(page.locator('#statusBar')).toContainText('Audit complete');
    await expect(page.locator('#rulesList')).toContainText('Simulated OCR response');
    await expect(page.locator('#scanButton')).toBeEnabled();
    await expect(page.locator('#photoList button')).toHaveCount(1);
    await expect(page.locator('#photoList button')).toContainText('label.png');
    await page.unroute('**/api/scan');
  }
  expect(errors).toEqual([]);
});

test('an OCR failure preserves the upload and permits a different engine retry', async ({ page }) => {
  await enterScanner(page);
  await page.locator('#fileInput').setInputFiles({ name: 'label.png', mimeType: 'image/png', buffer: image });
  await page.route('**/api/scan', route => route.fulfill({
    status: 422, json: { detail: 'Fixture cannot be read. Try a clearer photo.' },
  }));
  page.on('dialog', dialog => dialog.dismiss());
  await page.locator('#scanButton').click();
  await expect(page.locator('#statusBar')).toContainText('Fixture cannot be read');
  await expect(page.locator('#photoList button')).toHaveCount(1);
  await expect(page.locator('#photoList button')).toContainText('label.png');
  await expect(page.locator('#scanButton')).toBeEnabled();
  await page.locator('#tesseractOcrBtn').click();
  await expect(page.locator('#tesseractOcrBtn')).toHaveAttribute('aria-pressed', 'true');
  const retry = page.waitForRequest(request => new URL(request.url()).pathname === '/api/scan' && request.method() === 'POST');
  await page.locator('#scanButton').click();
  const request = await retry;
  const form = await new Response(new Uint8Array(request.postDataBuffer()!), {
    headers: { 'Content-Type': request.headers()['content-type'] },
  }).formData();
  expect(form.get('ocr_engine')).toBe('tesseract');
  await expect(page.locator('#scanButton')).toBeEnabled();
});
