import React from "react";
import VALUIndexV4Gate from "./VALUIndexV4Gate.jsx";
import FullVALUAssessment from "./FullVALUAssessment.jsx";

function continueToSignup() {
  const tasterId = localStorage.getItem("pending_taster_id");
  const name = localStorage.getItem("pending_taster_name");
  const role = localStorage.getItem("pending_taster_role");
  const experience = localStorage.getItem("pending_taster_experience") || "";
  if (!tasterId || !name || !role) {
    window.location.assign("https://valoriainstitute.com/professional-signup");
    return;
  }
  const params = new URLSearchParams({ taster_id: tasterId, name, role, experience });
  window.location.assign(`https://valoriainstitute.com/professional-signup?${params.toString()}`);
}

export default function VALUIndexV4App() {
  const params = new URLSearchParams(window.location.search);
  const full = params.get("full") === "1";
  return full ? <FullVALUAssessment /> : <VALUIndexV4Gate onComplete={continueToSignup} />;
}
