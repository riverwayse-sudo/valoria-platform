// valoria-final/src/__tests__/26_progress_persistence_contract.test.js
//
// The assessment footer told every participant "Progress is saved automatically."
// That was an assertion the code did not back: both persistence paths caught
// their errors and discarded them.
//
//   * the debounced autosave ended in `.catch(() => {})` — a complete swallow;
//   * persistCheckpoint() caught everything and acted only on handoff errors.
//
// So a participant whose session had expired, or who had lost connectivity,
// answered questions under a footer promising their work was safe, and could
// close the tab on an assessment the server had never received. Resume reads the
// server row, so the work was gone. A silent success claim on a failed write is
// the same class of defect as a submit button that does nothing: the UI tells the
// user something untrue about their data.

"use strict";

const fs = require("fs");
const path = require("path");

const SOURCE = fs.readFileSync(path.join(__dirname, "..", "FullVALUAssessment.jsx"), "utf8");

describe("progress persistence reporting", () => {
  test("the autosave does not discard its errors", () => {
    // The original shape. A bare catch with an empty body is the defect.
    expect(SOURCE).not.toMatch(/\.catch\(\(\)\s*=>\s*\{\s*\}\)/);
    expect(SOURCE).not.toMatch(/\.catch\(\(\)\s*=>\s*\{\}\)/);
  });

  test("the autosave records a failed save", () => {
    const autosave = SOURCE.match(/const timer = window\.setTimeout\(\(\) => \{([\s\S]*?)\n    \}, 250\);/);
    expect(autosave).not.toBeNull();
    expect(autosave[1]).toMatch(/setSaveState\('saved'\)/);
    expect(autosave[1]).toMatch(/setSaveState\('failed'\)/);
  });

  test("the checkpoint helper records a failed save too", () => {
    const checkpoint = SOURCE.match(/async function persistCheckpoint\(([\s\S]*?)\n  \}/);
    expect(checkpoint).not.toBeNull();
    expect(checkpoint[1]).toMatch(/setSaveState\('saved'\)/);
    expect(checkpoint[1]).toMatch(/setSaveState\('failed'\)/);
  });

  // The footer must not make an unconditional claim. It has to branch on the
  // observed outcome, otherwise the assurance is decorative.
  test("the footer reflects the observed save state", () => {
    const footer = SOURCE.match(/<div style=\{S\.footer\}>([\s\S]*?)<\/div>/);
    expect(footer).not.toBeNull();
    expect(footer[1]).toMatch(/saveState === 'failed'/);
    expect(footer[1]).toMatch(/saveState === 'saved'/);
    expect(footer[1]).toMatch(/could not be saved/);
  });

  test("the failure message is announced to assistive technology", () => {
    const footer = SOURCE.match(/<div style=\{S\.footer\}>([\s\S]*?)<\/div>/)[1];
    expect(footer).toMatch(/role="status"/);
  });

  // A local mirror is kept so an in-progress assessment survives a refresh even
  // when the server write fails. That is a genuine safeguard and must stay.
  test("a local mirror of in-progress answers is still written", () => {
    expect(SOURCE).toMatch(/window\.localStorage\.setItem\(resumeKey/);
  });

  // Ordering: the local mirror is written independently of the server save, so a
  // server failure does not also lose the local copy.
  test("the local mirror is not conditional on the server save succeeding", () => {
    const mirror = SOURCE.match(/window\.localStorage\.setItem\(resumeKey, JSON\.stringify\(\{([\s\S]*?)\}\)\);/);
    expect(mirror).not.toBeNull();
    expect(mirror[1]).not.toMatch(/saveState/);
  });
});

describe("handoff expiry is distinguished from a generic save failure", () => {
  // An expired handoff is recoverable by reopening from the account, so it must
  // not be reported as a connectivity problem, and vice versa.
  test("a handoff error transitions to account_required", () => {
    const checkpoint = SOURCE.match(/async function persistCheckpoint\(([\s\S]*?)\n  \}/)[1];
    expect(checkpoint).toMatch(/includes\('handoff'\)/);
    expect(checkpoint).toMatch(/setHandoffStatus\('account_required'\)/);
  });

  test("the two failure kinds are handled on separate branches", () => {
    const checkpoint = SOURCE.match(/async function persistCheckpoint\(([\s\S]*?)\n  \}/)[1];
    // handoff -> account_required; anything else -> saveState failed
    expect(checkpoint).toMatch(/else if \(mountedRef\.current\) \{\s*\n\s*setSaveState\('failed'\)/);
  });
});
