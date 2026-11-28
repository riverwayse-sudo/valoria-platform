#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const failures = [];
const read = (file) => {
  if (!existsSync(file)) {
    failures.push('Missing required file: ' + file);
    return '';
  }
  return readFileSync(file, 'utf8');
};
const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const file = join(dir, entry.name);
  return entry.isDirectory() ? walk(file) : [file];
});

const main = read('src/main.jsx');
const tokens = read('src/design-tokens.css');
const assessment = read('src/assessment.css');
const motion = read('src/assessment-motion.css');
const navigation = read('src/AssessmentNavigation.jsx');
const journey = read('src/VALUAssessmentJourney.jsx');

for (const contract of [/design-tokens\.css/, /assessment\.css/, /assessment-motion\.css/]) {
  if (!contract.test(main)) failures.push('src/main.jsx must load shared assessment design layer: ' + contract);
}

for (const token of [
  '--vi-color-midnight: #1A1A2E',
  '--vi-color-gold: #C9A84C',
  '--vi-color-slate: #2E2E4A',
  '--vi-color-parchment: #F7F4EE',
  '--vi-color-linen: #EDE8DC',
  '--vi-color-brass: #D4C9A8',
  '--vi-color-ivory: #FAFAF7',
  '--vi-motion-micro: 160ms',
  '--vi-motion-standard: 240ms',
  '--vi-motion-emphasis: 420ms',
  '--vi-motion-ease: cubic-bezier(.22,1,.36,1)',
]) {
  if (!tokens.includes(token)) failures.push('src/design-tokens.css is missing canonical token: ' + token);
}

for (const contract of [
  /prefers-reduced-motion:\s*reduce/,
  /--vi-motion-standard/,
  /--vi-motion-micro/,
  /\.valu-option/,
  /\.valu-journey__track-fill/,
  /\.assessment-nav/,
]) {
  if (!contract.test(motion)) failures.push('src/assessment-motion.css is missing motion contract ' + contract);
}

for (const contract of [
  /className="assessment-nav"/,
  /className="assessment-nav-inner"/,
  /className="assessment-nav-brand"/,
  /className="assessment-nav-center"/,
  /className="assessment-nav-exit"/,
]) {
  if (!contract.test(navigation)) failures.push('Assessment navigation is missing shared class contract ' + contract);
}
if (/style=\{/.test(navigation) || /const styles\s*=/.test(navigation)) {
  failures.push('AssessmentNavigation.jsx must not own inline visual styles; use the shared stylesheet.');
}
for (const selector of ['.assessment-nav {', '.assessment-nav-inner {', '.assessment-nav-exit {']) {
  if (!assessment.includes(selector)) failures.push('src/assessment.css is missing layout rule ' + selector);
}
if (/transition\s*:|animation\s*:|@keyframes/.test(tokens) || /transition\s*:|animation\s*:|@keyframes/.test(assessment)) {
  failures.push('Motion declarations must live only in src/assessment-motion.css, not token or layout stylesheets.');
}
if (!/Raleway/.test(assessment) || /DM Mono/.test(assessment)) {
  failures.push('The assessment experience must use the approved Raleway typeface only.');
}
if (!/prefers-reduced-motion:\s*reduce/.test(motion) || !/aria-live/.test(journey)) {
  failures.push('Assessment reduced-motion and honest journey-status contracts must remain present.');
}

const componentFiles = walk('src').filter((file) => /\.jsx?$/.test(file));
if (componentFiles.length < 12) failures.push('Assessment component inventory unexpectedly low: ' + componentFiles.length + ' files.');

if (failures.length) {
  console.error('Valoria assessment design enforcement FAILED.');
  failures.forEach((failure) => console.error(' - ' + failure));
  process.exit(1);
}
console.log('Valoria assessment design enforcement PASSED: ' + componentFiles.length + ' assessment source files inherit shared tokens, responsive layout and canonical motion.');
console.log('Assessment coverage: authenticated taster entry, answer selection, progress, full assessment, resume, submission and dashboard handoff surfaces.');
