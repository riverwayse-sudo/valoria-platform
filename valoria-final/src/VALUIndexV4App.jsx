import React from "react";
import VALUIndexV4GateNext from "./VALUIndexV4GateNext.jsx";
import FullVALUAssessment from "./FullVALUAssessment.jsx";

export default function VALUIndexV4App() {
  const params = new URLSearchParams(window.location.search);
  const full = params.get("full") === "1";
  if (full) return <FullVALUAssessment />;
  // Account creation and one-click email confirmation are required before the Taster.
  // The legacy Taster-first component is intentionally not a public entry route.
  return <VALUIndexV4GateNext />;
}
