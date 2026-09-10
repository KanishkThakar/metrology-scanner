import { test, expect } from '@playwright/test';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import catalog from '../packages/core/catalog.json';
const base=process.env.TEST_WEB_URL||'http://127.0.0.1:3001';
const api=process.env.TEST_API_URL||'http://127.0.0.1:8011';
const errors:string[]=[];

test('existing web workflows survive the Next.js migration',async({page,request})=>{
  test.setTimeout(180000);
  execFileSync(path.resolve('.venv/bin/python'),['scripts/prepare-test-fixtures.py']);
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>localStorage.setItem('doca_tour_done','true'));
  await page.goto(base);
  await expect(page.locator('#backendStatusPill')).toContainText('Online');
  await expect(page.locator('#stateDropdown option')).toHaveCount(30);
  await page.locator('#citizenIdentityInput').fill('scanner-test@example.com');
  await page.locator('#citizenLoginForm button').click();
  await expect(page.locator('#roleGatewayModal')).toBeHidden();
  await page.locator('#themeToggleBtn').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  await page.locator('#themeToggleBtn').click();
  await page.locator('#languageSelector').selectOption('hi');
  await expect(page.locator('#lblUploadTitle')).toHaveText(catalog.i18n.hi.lblUploadTitle);
  await page.locator('#languageSelector').selectOption('en');
  await page.locator('#viewRulesBtn').click();
  await expect(page.locator('#rulesModal')).toBeVisible();
  await expect(page.locator('#rulesListModalContent')).not.toBeEmpty();
  await page.locator('#closeRulesModal').click();
  await page.locator('#fileInput').setInputFiles([path.resolve('work/side-1.jpg'),path.resolve('work/side-2.jpg')]);
  await expect(page.locator('#photoList button')).toHaveCount(2);
  const scanResponse=page.waitForResponse(r=>r.url()===api+'/api/scan'&&r.request().method()==='POST');
  await page.locator('#scanButton').click();
  const scan=await (await scanResponse).json();
  expect(scan.photo_count).toBe(2);expect(scan.rules.font_compliance.status).toBe('REVIEW');
  await expect(page.locator('#statusBar')).toContainText('Audit complete');
  await expect(page.locator('#rulesList .rule-card')).toHaveCount(Object.keys(scan.rules).length);
  const report=await request.get(api+scan.report_pdf_url);expect(report.ok()).toBeTruthy();expect((await report.body()).subarray(0,4).toString()).toBe('%PDF');
  for (const photo of scan.photos) expect((await request.get(api+photo.image_url)).ok()).toBeTruthy();
  await page.locator('#fileComplaintBtn').click();
  await page.locator('#dispatchContactInput').fill('draft-test@example.com');
  page.once('dialog',dialog=>dialog.accept());
  const draftResponse=page.waitForResponse(r=>r.url().endsWith('/api/complaints/dispatch'));
  await page.locator('#dispatchForm button').click();
  expect((await (await draftResponse).json()).status).toBe('DRAFT');
  await page.locator('#aiFab').click();
  await page.locator('#chatTextInput').fill('cooling charges above MRP');
  await page.locator('#chatSendBtn').click();
  await expect(page.locator('#chatMessages .ai').last()).toContainText('MRP');
  await page.locator('#chatCloseBtn').click();
  await page.locator('#logoutBtn').click();
  await page.locator('#tabOfficerBtn').click();
  await page.locator('#officerIdInput').fill('MIGRATION-QA');
  await page.locator('#officerPassInput').fill('demo');
  await page.locator('#officerLoginForm button').click();
  await expect(page.locator('#historyTableBody tr').first()).toBeVisible();
  for(const id of ['exportCsvBtn','exportJsonBtn']){
    const download=page.waitForEvent('download');await page.locator('#'+id).click();expect((await download).suggestedFilename()).toMatch(/\.(csv|json)$/);
  }
  const coffeePath=process.env.OCR_COFFEE_IMAGE;
  if(coffeePath&&existsSync(coffeePath)){
  await page.locator('#fileInput').setInputFiles(path.resolve(coffeePath));
  // File inputs append by design; remove the previous two sides before the coffee scan.
  await page.locator('#photoList button').first().click();
  await page.locator('#photoList button').first().click();
  const coffeeResponse=page.waitForResponse(r=>r.url()===api+'/api/scan'&&r.request().method()==='POST');
  await page.locator('#scanButton').click();
  const coffee=await (await coffeeResponse).json();expect(coffee.rules.mrp.detected_value).toBe('₹ 99.00');expect(coffee.rules.mrp.status).toBe('REVIEW');
  await expect(page.locator('#rulesList')).toContainText('₹ 99.00');
  await expect(page.locator('#rulesList')).toContainText('View price OCR readings');
  await page.locator('#guideStepAudit').scrollIntoViewIfNeeded();
  await page.screenshot({path:'work/next-coffee-evidence.png',fullPage:true});
  }
  expect(errors).toEqual([]);
});
