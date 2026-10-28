"use strict";

/**
 * The snapshot gate is a React component the suite does not render, so this
 * asserts the contract that makes the server's ACCOUNT_EXISTS response usable:
 * the client must key off the stable code, offer a sign-in route, and not
 * re-attempt account creation once an account is known to exist.
 *
 * The sign-in link must be built from siteUrl() rather than a hardcoded origin.
 * Hardcoding https://valoriainstitute.com sent a staging participant to the
 * production login while their account lived in the staging database.
 */

const fs = require("fs");
const path = require("path");

const GATE = fs.readFileSync(path.join(__dirname, "../VALUIndexV4GateNext.jsx"), "utf8");

describe("VALU snapshot existing-account UI contract", () => {
  test("branches on the server's stable ACCOUNT_EXISTS code, not on message wording", () => {
    expect(GATE).toContain("data.code==='ACCOUNT_EXISTS'");
  });

  test("builds the sign-in link from the environment-aware siteUrl helper", () => {
    expect(GATE).toContain("siteUrl('/login')");
    expect(GATE).toContain("import { siteUrl } from './siteOrigin.js'");
  });

  test("does not hardcode the production origin for navigation links", () => {
    // Hardcoding production sent staging participants to the production login.
    expect(GATE).not.toMatch(/href=\{?["'`]https:\/\/valoriainstitute\.com\/login/);
  });

  test("explains that existing progress and records are preserved", () => {
    expect(GATE).toContain("records are kept");
  });

  test("keeps account creation single-shot so a retry cannot create a duplicate account", () => {
    // The accountCreated guard must still wrap the create-account request.
    expect(GATE).toMatch(/if\(!accountCreated\)\{/);
  });

  test("does not expose the provider's raw error text to the user", () => {
    expect(GATE).not.toContain("already been registered");
    expect(GATE).not.toContain("error_code");
  });
});
