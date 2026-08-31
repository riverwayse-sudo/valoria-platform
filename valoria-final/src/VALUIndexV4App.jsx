import React, { useEffect, useState } from "react";
import ValoriaPlatform from "./ValoriaPlatform.jsx";
import VALUIndexV4Gate from "./VALUIndexV4Gate.jsx";
import PRIMEAssessmentV4 from "./prime-assessment-v4.jsx";

const TASTER_SEEN_KEY = "valu_v4_taster_seen";

function hasSeenTaster() {
  try { return localStorage.getItem(TASTER_SEEN_KEY) === "1"; } catch { return false; }
}

// Opt-in standalone route for the drop-in two-stage v4 component. Kept
// separate from the default production flow (ValoriaPlatform + taster gate)
// so the shipped path is unchanged. Reach via ?flow=v4-standalone.


function isStandaloneV4() {
  try {
    const qp = new URLSearchParams(window.location.search);
    return qp.get("flow") === "v4-standalone" || qp.get("v4") === "standalone";
  } catch { return false; }
}

export default function VALUIndexV4App() {
  const [showTaster, setShowTaster] = useState(() => !hasSeenTaster());

  if (isStandaloneV4()) return <PRIMEAssessmentV4 />;

  useEffect(() => {
    if (showTaster) {
      try { document.body.style.overflow = "hidden"; } catch {}
    } else {
      try { document.body.style.overflow = ""; } catch {}
    }
    return () => { try { document.body.style.overflow = ""; } catch {} };
  }, [showTaster]);

  function continueToFullAssessment() {
    try { localStorage.setItem(TASTER_SEEN_KEY, "1"); } catch {}
    setShowTaster(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <>
      <ValoriaPlatform />
      {showTaster && <VALUIndexV4Gate onComplete={continueToFullAssessment} />}
    </>
  );
}
