import React from "react";
import VALUIndexV4GateNext from "./VALUIndexV4GateNext.jsx";
import FullVALUAssessment from "./FullVALUAssessment.jsx";

export default function VALUIndexV4App() {
  const params = new URLSearchParams(window.location.search);
  const full = params.get('full') === '1';
  return full ? <FullVALUAssessment /> : <VALUIndexV4GateNext />;
}
