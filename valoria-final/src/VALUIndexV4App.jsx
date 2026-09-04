import React from "react";
import VALUIndexV4Gate from "./VALUIndexV4Gate.jsx";

// VALU Index v4 production entry.
// The public assessment is intentionally the canonical 15-question directional
// snapshot only. The legacy 55-question assessment is not part of this route.
// After the directional result, the user continues into the Valoria platform
// to complete their professional identity/profile and enter the marketplace.

const VALORIA_PROFILE_SETUP = "https://valoriainstitute.com/profile/setup";

export default function VALUIndexV4App() {
  function continueToValoria() {
    try {
      localStorage.setItem("valu_v4_profile_intent", "1");
    } catch {}
    window.location.assign(VALORIA_PROFILE_SETUP);
  }

  return <VALUIndexV4Gate onComplete={continueToValoria} />;
}
