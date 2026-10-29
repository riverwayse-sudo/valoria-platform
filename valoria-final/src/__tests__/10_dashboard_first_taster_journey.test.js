"use strict";
const fs = require("fs");
const path = require("path");

const source = fs.readFileSync(path.join(__dirname, "../VALUIndexV4GateNext.jsx"), "utf8");

describe("dashboard-first VALU taster journey", () => {
  test("uses the canonical nine-question taster before account creation", () => {
    expect(source).toContain("TASTER_QUESTIONS.length");
    expect(source).toContain("START MY 9-QUESTION TASTER");
    expect(source).not.toContain("15-question");
    expect(source).not.toContain("'/api/create-account'");
    expect(source).toContain("action:'init'");
  });

  test("sends completed snapshots to the site signup flow with the exact taster identity", () => {
    expect(source).toContain("professional-signup/?taster_id=");
    expect(source).toContain("encodeURIComponent(tasterId)");
    expect(source).toContain("encodeURIComponent(name)");
    expect(source).toContain("encodeURIComponent(role)");
    expect(source).toContain("encodeURIComponent(experience)");
    expect(source).toContain("pending_taster_id=");
    expect(source).toContain("returnTo=%2Fdashboard");
  });

  test("does not show results when the API fails to return a taster id", () => {
    expect(source).toContain("if(!data.taster_id)throw new Error('Your saved snapshot is missing its continuation reference. Please retry.')");
  });
});
