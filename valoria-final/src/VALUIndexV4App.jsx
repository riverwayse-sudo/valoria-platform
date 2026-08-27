import React, { useEffect, useState } from "react";
import ValoriaPlatform from "./ValoriaPlatform.jsx";
import VALUIndexV4Gate from "./VALUIndexV4Gate.jsx";

const TASTER_SEEN_KEY = "valu_v4_taster_seen";

function hasSeenTaster() {
  try { return localStorage.getItem(TASTER_SEEN_KEY) === "1"; } catch { return false; }
}

export default function VALUIndexV4App() {
  const [showTaster, setShowTaster] = useState(() => !hasSeenTaster());

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
