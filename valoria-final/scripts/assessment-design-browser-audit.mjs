import fs from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.STAGING_ASSESSMENT_URL || 'https://assessment-staging.valoriainstitute.com';
const viewports = [
  { name: 'desktop', width: 1440, height: 960 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
];
const failures = [];
const results = [];
await fs.mkdir('artifacts/assessment-design-audit', { recursive: true });
const browser = await chromium.launch({ headless: true });

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    let status = null;
    let metrics = null;
    let navigationError = null;
    try {
      const response = await page.goto(\`\${base}/valu/assessment/?journey=account-first\`, {
        waitUntil: 'domcontentloaded',
        timeout: 45000,
      });
      status = response?.status() ?? null;
      await page.waitForSelector('#root', { state: 'attached', timeout: 15000 });
      await page.waitForTimeout(1200);
      metrics = await page.evaluate(() => ({
        viewportWidth: window.innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        bodyTextLength: (document.body?.innerText || '').trim().length,
        fontFamily: getComputedStyle(document.body).fontFamily,
        rootTextLength: (document.querySelector('#root')?.innerText || '').trim().length,
        mainLandmarks: document.querySelectorAll('main,[role="main"]').length,
      }));
      await page.screenshot({ path: \`artifacts/assessment-design-audit/\${viewport.name}.png\`, fullPage: true });
    } catch (error) {
      navigationError = error.message;
    }
    const errors = [
      ...(status == null || status >= 400 ? [\`HTTP \${status}\`] : []),
      ...(navigationError ? [navigationError] : []),
      ...(metrics && metrics.documentWidth > metrics.viewportWidth + 2 ? ['horizontal overflow'] : []),
      ...(metrics && metrics.bodyTextLength === 0 ? ['blank assessment document'] : []),
      ...(metrics && metrics.rootTextLength === 0 ? ['blank assessment application root'] : []),
      ...(metrics && !/Raleway/i.test(metrics.fontFamily) ? [\`unexpected assessment typeface: \${metrics.fontFamily}\`] : []),
      ...pageErrors,
    ];
    const result = { viewport, status, metrics, errors };
    results.push(result);
    if (errors.length) failures.push(result);
    await context.close();
  }
} finally {
  await browser.close();
}

await fs.writeFile('artifacts/assessment-design-audit/report.json', JSON.stringify({
  generatedAt: new Date().toISOString(),
  environment: 'isolated Cloudflare staging only',
  base,
  results,
  failures,
}, null, 2));

console.log(\`Assessment design audit completed across \${viewports.length} viewports.\`);
if (failures.length) {
  console.error(\`Assessment design audit FAILED: \${failures.length} viewport checks.\`);
  failures.forEach((failure) => console.error(JSON.stringify(failure)));
  process.exit(1);
}
console.log('Assessment design audit PASSED: desktop, tablet and mobile entry surfaces rendered without overflow or runtime errors.');
