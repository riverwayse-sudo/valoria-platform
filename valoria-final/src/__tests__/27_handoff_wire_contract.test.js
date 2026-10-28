// valoria-final/src/__tests__/27_handoff_wire_contract.test.js
//
// The site → platform handoff is a cross-repository wire format with no shared
// schema, so each side can only be tested against its own source. The site
// already asserts that it puts the token in the fragment (`destination.hash`).
// The platform had no matching assertion that it *reads* the token from the
// fragment. Change the reader to look in the query string and the site's tests
// still pass, the platform's tests still pass, and the handoff breaks in
// production for every participant.
//
// This pins the consumer half. It is deliberately specific about where each
// value travels, because the split is a security decision, not a style choice:
//
//   * the token travels in the fragment, which browsers do not send to the
//     server, so it stays out of server logs and Referer headers;
//   * the identity fields travel in the query string, which the platform reads
//     on load.
//
// Moving the token to the query string would leak it into logs. That is the
// failure this test exists to prevent.

"use strict";

const fs = require("fs");
const path = require("path");

const SOURCE = fs.readFileSync(path.join(__dirname, "..", "FullVALUAssessment.jsx"), "utf8");

describe("handoff wire format (consumer side)", () => {
  test("the token is read from the URL fragment, not the query string", () => {
    const reader = SOURCE.match(/function readHandoffToken\(\) \{([\s\S]*?)\n\}/);
    expect(reader).not.toBeNull();
    expect(reader[1]).toMatch(/window\.location\.hash/);
    expect(reader[1]).toMatch(/handoff_token/);
    expect(reader[1]).not.toMatch(/window\.location\.search/);
  });

  test("the fragment is cleared from the address bar once the token is captured", () => {
    // Otherwise the token sits in history and in any screenshot or paste of the
    // URL. replaceState avoids adding a history entry.
    expect(SOURCE).toMatch(/history\.replaceState/);
    const capture = SOURCE.match(/fromHash = readHandoffToken\(\);([\s\S]{0,300}?)\n\s*\} catch/);
    expect(capture).not.toBeNull();
    expect(capture[1]).toMatch(/replaceState/);
  });

  test("the captured token is kept in session storage, not local storage", () => {
    // Session storage is scoped to the tab and cleared on close. A handoff token
    // in local storage would outlive the session it authorises.
    const capture = SOURCE.match(/fromHash = readHandoffToken\(\);([\s\S]{0,300}?)\n\s*\} catch/)[1];
    expect(capture).toMatch(/sessionStorage\.setItem/);
    expect(capture).not.toMatch(/localStorage/);
  });

  test("the identity fields the site issues are the ones the platform reads", () => {
    const parser = SOURCE.match(/function parseQuery\(\) \{([\s\S]*?)\n\}/);
    expect(parser).not.toBeNull();
    for (const param of ["taster_id", "name", "role", "experience"]) {
      expect(parser[1]).toContain(param);
    }
  });

  test("a resume parameter is supported for interrupted sessions", () => {
    const parser = SOURCE.match(/function parseQuery\(\) \{([\s\S]*?)\n\}/)[1];
    expect(parser).toContain("resume");
  });

  // The site sends identity in the query and the token in the fragment; if the
  // platform ever reads identity from the fragment too, the two halves disagree
  // and one of them silently yields empty strings.
  test("identity is read from the query string, not the fragment", () => {
    const parser = SOURCE.match(/function parseQuery\(\) \{([\s\S]*?)\n\}/)[1];
    expect(parser).toMatch(/window\.location\.search/);
    expect(parser).not.toMatch(/location\.hash/);
  });

  test("the token is verified with the server before the assessment is usable", () => {
    // A token that is merely present must not be trusted; it has to be exchanged
    // for confirmation before handoffStatus becomes 'ready'.
    expect(SOURCE).toMatch(/action:'verify-handoff'/);
    const verify = SOURCE.match(/action:'verify-handoff'([\s\S]{0,900}?)setHandoffStatus\('ready'\)/);
    expect(verify).not.toBeNull();
    expect(verify[1]).toMatch(/if \(!response\.ok \|\| !data\.ok\) throw/);
  });

  test("a rejected token is discarded rather than retried indefinitely", () => {
    const verify = SOURCE.match(/action:'verify-handoff'([\s\S]*?)\}, \[identity\.tasterId/);
    expect(verify).not.toBeNull();
    expect(verify[1]).toMatch(/sessionStorage\.removeItem\(storageKey\)/);
    expect(verify[1]).toMatch(/setHandoffStatus\('account_required'\)/);
  });
});
