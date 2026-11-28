import fs from 'node:fs';
import path from 'node:path';

const read = (file) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('Valoria assessment design and motion enforcement', () => {
  test('the assessment shell loads the canonical design, layout and motion layers', () => {
    const main = read('src/main.jsx');
    expect(main).toContain("import './design-tokens.css'");
    expect(main).toContain("import './assessment.css'");
    expect(main).toContain("import './assessment-motion.css'");
  });

  test('assessment navigation delegates all visual geometry to shared CSS', () => {
    const navigation = read('src/AssessmentNavigation.jsx');
    expect(navigation).toContain('className="assessment-nav"');
    expect(navigation).toContain('className="assessment-nav-inner"');
    expect(navigation).toContain('className="assessment-nav-exit"');
    expect(navigation).not.toMatch(/style=\\{/);
    expect(navigation).not.toContain('const styles =');
    const css = read('src/assessment.css');
    expect(css).toContain('.assessment-nav {');
    expect(css).toContain('.assessment-nav-inner {');
    expect(css).toContain('.assessment-nav-exit {');
  });

  test('assessment answers and journey progress use canonical motion tokens', () => {
    const motion = read('src/assessment-motion.css');
    expect(motion).toContain('var(--vi-motion-micro)');
    expect(motion).toContain('var(--vi-motion-standard)');
    expect(motion).toContain('.valu-option');
    expect(motion).toContain('.valu-journey__track-fill');
  });

  test('touch hover is restricted to fine pointers and reduced motion is respected', () => {
    const motion = read('src/assessment-motion.css');
    expect(motion).toContain('@media (hover: hover) and (pointer: fine)');
    expect(motion).toContain('@media (prefers-reduced-motion: reduce)');
    expect(motion).toContain('transition: none !important');
  });

  test('assessment retains the approved typeface and institutional palette', () => {
    const tokens = read('src/design-tokens.css');
    const css = read('src/assessment.css');
    expect(tokens).toContain('--vi-color-midnight: #1A1A2E');
    expect(tokens).toContain('--vi-color-gold: #C9A84C');
    expect(tokens).toContain('--vi-color-parchment: #F7F4EE');
    expect(css).toContain("font-family: 'Raleway', sans-serif");
    expect(css).not.toContain('DM Mono');
  });
});
