import fs from 'node:fs';
import path from 'node:path';

const read = file => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('assessment staging telemetry and indexing isolation', () => {
  test('assessment shell is noindex and contains no hardcoded production analytics', () => {
    const html = read('index.html');
    expect(html).toContain('<meta name="robots" content="noindex,nofollow" />');
    expect(html).not.toContain('googletagmanager.com');
    expect(html).not.toContain('valoriainstitute.com/logo.png');
  });

  test('preview builds display a staging banner and never load production analytics', () => {
    const main = read('src/main.jsx');
    const css = read('src/assessment.css');
    expect(main).toContain("import.meta.env.VITE_VALU_PREVIEW === '1'");
    expect(main).toContain('if (!import.meta.env.PROD || isPreview) return');
    expect(main).toContain('staging-site-banner');
    expect(main).toContain('G-63M4SRXQKM');
    expect(css).toContain('.staging-site-banner');
  });

  test('staging build enables preview mode while production explicitly disables it', () => {
    const staging = fs.readFileSync(path.join(process.cwd(), '../.github/workflows/cloudflare-assessment-staging-pr-deploy.yml'), 'utf8');
    const production = fs.readFileSync(path.join(process.cwd(), '../.github/workflows/cloudflare-assessment-production-deploy.yml'), 'utf8');
    expect(staging).toContain('VITE_VALU_PREVIEW: "1"');
    expect(production).toContain('VITE_VALU_PREVIEW: "0"');
  });
});
