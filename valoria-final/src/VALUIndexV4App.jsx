import React from "react";
import VALUIndexV4GateNext from "./VALUIndexV4GateNext.jsx";
import VALUIndexTasterFirst from "./VALUIndexTasterFirst.jsx";
import FullVALUAssessment from "./FullVALUAssessment.jsx";

function continueFromLegacyTaster({ tasterId, name, role, experience, email }) {
  if (!tasterId || !name || !role || !experience || !email) return;
  const host = window.location.hostname.toLowerCase();
  const approved = new Set([
    "https://valoriainstitute.com",
    "https://www.valoriainstitute.com",
    "https://staging.valoriainstitute.com",
  ]);
  const requested = new URLSearchParams(window.location.search).get("site_origin");
  let siteOrigin = "";
  try {
    const parsed = new URL(requested || "");
    if (parsed.protocol === "https:" && approved.has(parsed.origin)) siteOrigin = parsed.origin;
  } catch {}
  if (!siteOrigin) {
    if (host === "assessment.valoriainstitute.com") siteOrigin = "https://valoriainstitute.com";
    else if (host === "assessment-staging.valoriainstitute.com") siteOrigin = "https://staging.valoriainstitute.com";
    else if (approved.has(window.location.origin)) siteOrigin = window.location.origin;
    else siteOrigin = "https://valoriainstitute.com";
  }
  const params = new URLSearchParams({ taster_id: tasterId, name, role, experience, email });
  window.location.assign(siteOrigin + "/professional-signup/?" + params.toString());
}

export default function VALUIndexV4App() {
  const params = new URLSearchParams(window.location.search);
  const full = params.get("full") === "1";
  const legacyTasterFirst = params.get("journey") === "taster-first";
  let hasSavedLegacyTaster = false;
  try {
    hasSavedLegacyTaster = Boolean(window.localStorage.getItem("valu_taster_first_resume_token"));
  } catch {}
  if (full) return <FullVALUAssessment />;
  // Only an explicitly requested or already-saved legacy session can enter Taster-first.
  if (legacyTasterFirst || hasSavedLegacyTaster) {
    return <VALUIndexTasterFirst onComplete={continueFromLegacyTaster} />;
  }
  // New participants must create and confirm their account before the Taster.
  return <VALUIndexV4GateNext />;
}
