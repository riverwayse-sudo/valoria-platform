import React from "react";
import VALUIndexV4GateNext from "./VALUIndexV4GateNext.jsx";
import VALUIndexTasterFirst from "./VALUIndexTasterFirst.jsx";
import FullVALUAssessment from "./FullVALUAssessment.jsx";

function continueFromTasterFirst({ tasterId, name, role, experience, email }) {
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
  const tasterFirst = params.get("journey") === "taster-first";
  if (full) return <FullVALUAssessment />;
  if (tasterFirst) return <VALUIndexTasterFirst onComplete={continueFromTasterFirst} />;
  return <VALUIndexV4GateNext />;
}
