import fs from 'node:fs';
import path from 'node:path';

describe('canonical VALU Index completion communication', () => {
  const source = fs.readFileSync(path.join(process.cwd(), 'api/create-account.js'), 'utf8');

  test('completion email uses VALU Index as the product name', () => {
    expect(source).toContain('your VALU Index is complete and your result is saved.');
    expect(source).toContain('title: "Your VALU Index is complete"');
    expect(source).toContain('body: "Your VALU Index is saved.');
    expect(source).toContain('subject: "Your VALU Index Is Saved — Here\'s What Happens Next"');
    expect(source).not.toMatch(/your VALU assessment is complete/i);
    expect(source).not.toMatch(/Your VALU Assessment Is Saved/i);
  });
});
