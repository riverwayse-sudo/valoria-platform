"use strict";

import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(path.join(process.cwd(), "src/VALUIndexV4GateNext.jsx"), "utf8");

describe("account-required taster entry", () => {
  test("sends users to the account-first signup route, not the legacy post-taster recovery route", () => {
    expect(source).toContain("'/valu/register/?journey=valu_taster'");
    expect(source).not.toContain("'/professional-signup/?journey=valu_taster'");
  });
});
