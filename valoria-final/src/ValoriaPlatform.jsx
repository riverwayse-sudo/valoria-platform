import { useState, useEffect, useRef, useMemo } from "react";

const SUPABASE_URL = "https://sbkgpisgkuhbalsxqkdr.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNia2dwaXNna3VoYmFsc3hxa2RyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzMjI2NjEsImV4cCI6MjA5Mzg5ODY2MX0.iRPs_W6O6JkkHyVlH-9XkEgA1HNo8xtaMakoV5kwLEY";

async function saveToSupabase(data) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/valu_assessments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        "Prefer": "return=minimal"
      },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.text();
      console.error("Supabase save error:", err);
    }
  } catch(e) {
    console.error("Supabase save failed:", e);
  }
}

const GOLD = "#C9A84C";
const DARK = "#1A1A2E";
const MID = "#2E2E4A";
const PARCHMENT = "#F7F4EE";
const ACCENT = "#EDE8DC";
const AMBER = "#E8A020";

function useWindowWidth() {
  const [width, setWidth] = useState(typeof window !== "undefined" ? window.innerWidth : 1200);
  useEffect(() => {
    const handler = () => setWidth(window.innerWidth);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return width;
}

// ── CLUSTER CONFIG ─────────────────────────────────────────────────────────
const CLUSTERS = [
  { id:"P", name:"Presence",      theme:"How you show up",  color:"#1D9E75", weight:0.20, maxRaw:36 },
  { id:"R", name:"Relationships", theme:"How you connect",  color:"#378ADD", weight:0.25, maxRaw:48 },
  { id:"I", name:"Intelligence",  theme:"How you think",    color:"#7F77DD", weight:0.25, maxRaw:60 },
  { id:"M", name:"Mastery",       theme:"How you deliver",  color:"#BA7517", weight:0.20, maxRaw:36 },
  { id:"E", name:"Enterprise",    theme:"How you create",   color:"#D85A30", weight:0.10, maxRaw:36 },
];

const DESIGNATIONS = [
  { min:80, name:"Force to Align With",    color:GOLD,      bg:"rgba(201,168,76,0.12)",  desc:"Operating at the highest expression of professional capability." },
  { min:65, name:"Emerging Force",         color:"#378ADD", bg:"rgba(55,138,221,0.10)",  desc:"Strong foundations with clear areas of excellence." },
  { min:50, name:"Developing Professional",color:"#1D9E75", bg:"rgba(29,158,117,0.10)",  desc:"Genuine capability with uneven development." },
  { min:35, name:"Building Foundations",   color:"#BA7517", bg:"rgba(186,117,23,0.10)",  desc:"Early-stage professional architecture." },
  { min:0,  name:"At the Starting Point",  color:"rgba(247,244,238,0.3)", bg:"rgba(247,244,238,0.05)", desc:"Complete a PRIME Sprint to qualify for listing." },
];

// [QUESTION BANK - Keep all your existing questions here exactly as they are]
// For brevity, I'm showing the structure - but KEEP YOUR FULL QUESTION BANK
// (ALL_QUESTIONS array with all 55+ questions)

// For the complete file, I'll include the full question bank
// But to save space here, I'll note that you should KEEP your existing ALL_QUESTIONS

// ── MAIN COMPONENT ────────────────────────────────────────────────────────
export default function PRIMEAssessment({ onComplete, assessmentExpiresAt }) {
  const winWidth = useWindowWidth();
  const isDesktop = winWidth >= 900;
  
  const [phase, setPhase] = useState("intro");
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState({});
  const [selected, setSelected] = useState(null);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [timings, setTimings] = useState([]);
  const [qStartTime, setQStartTime] = useState(null);
  const [results, setResults] = useState(null);
  const [transitioning, setTransitioning] = useState(false);
  const [shuffleMap, setShuffleMap] = useState({});
  const [sessionSeed] = useState(() => Math.random() * 99999);
  
  const [reportText, setReportText] = useState("");
  const [reportStatus, setReportStatus] = useState("idle");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupError, setSignupError] = useState("");
  const [signupLoading, setSignupLoading] = useState(false);
  const [signupDone, setSignupDone] = useState(false);
  const [showRetakeModal, setShowRetakeModal] = useState(false);

  // ── INTRO SCREEN WITH PROPER TWO-COLUMN LAYOUT ──────────────────────────
  if (phase === "intro") {
    const canBegin = name.trim().length > 0 && role.trim().length > 0;
    
    return (
      <div style={{
        minHeight:"100vh", background:DARK,
        fontFamily:"'DM Sans',sans-serif",
        position:"relative", overflowX:"hidden",
      }}>
        {/* Noise grain overlay */}
        <div style={{
          position:"fixed", inset:0, pointerEvents:"none", zIndex:0, opacity:0.035,
          backgroundImage:`url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize:"256px",
        }}/>
        
        {/* Ambient gold glow */}
        <div style={{
          position:"fixed", inset:0, pointerEvents:"none", zIndex:0,
          background:"radial-gradient(ellipse 100% 50% at 50% 0%, rgba(201,168,76,0.09) 0%, transparent 60%)",
        }}/>
        
        {/* PRIME cluster stripe */}
        <div style={{position:"fixed",top:0,left:0,right:0,height:3,display:"flex",zIndex:10}}>
          {[["#1D9E75",20],["#378ADD",25],["#7F77DD",25],["#BA7517",20],["#D85A30",10]].map(([color,pct],i)=>(
            <div key={i} style={{flex:pct,background:color,opacity:0.9}}/>
          ))}
        </div>

        {/* MAIN CONTAINER - TWO COLUMN LAYOUT */}
        <div style={{
          position:"relative", zIndex:1,
          maxWidth: isDesktop ? 1400 : 600,
          margin:"0 auto",
          padding: isDesktop ? "60px 48px" : "40px 20px",
          display:"flex",
          flexDirection: isDesktop ? "row" : "column",
          gap: isDesktop ? 80 : 0,
          width: "100%",
          boxSizing: "border-box",
        }}>
          
          {/* LEFT COLUMN - Desktop only - Branding & Info */}
          {isDesktop && (
            <div style={{
              flex: "1.2",
              paddingRight: 20,
            }}>
              {/* Wordmark */}
              <div style={{marginBottom: 48}}>
                <div style={{
                  fontFamily:"'Cormorant Garamond',Georgia,serif",
                  fontSize: 36, fontWeight: 600, color: GOLD,
                  letterSpacing: "0.2em", lineHeight: 1, marginBottom: 4,
                }}>VALORIA</div>
                <div style={{fontSize: 10, color: "rgba(201,168,76,0.4)", letterSpacing: "0.3em"}}>INSTITUTE</div>
              </div>
              
              {/* Badge */}
              <div style={{
                display:"inline-flex", alignItems:"center", gap: 8,
                padding:"5px 14px", background:"rgba(201,168,76,0.08)",
                border:"1px solid rgba(201,168,76,0.2)", borderRadius: 100,
                marginBottom: 28,
              }}>
                <div style={{width: 6, height: 6, borderRadius: "50%", background: GOLD}}/>
                <span style={{fontSize: 10, fontWeight: 600, color: GOLD, letterSpacing: "0.2em"}}>FOUNDING COHORT — NOW OPEN</span>
              </div>
              
              {/* Headline */}
              <h1 style={{
                fontFamily:"'Cormorant Garamond',Georgia,serif",
                fontSize: "clamp(48px, 6vw, 72px)",
                fontWeight: 300, lineHeight: 1, letterSpacing: "-0.025em",
                color: PARCHMENT, margin: "0 0 24px",
              }}>
                Know exactly<br/>where you <em style={{fontStyle:"italic", color: GOLD}}>stand.</em>
              </h1>
              
              <p style={{
                fontSize: 17, fontWeight: 300, color: "rgba(247,244,238,0.5)",
                lineHeight: 1.7, margin: "0 0 48px", maxWidth: 480,
              }}>
                55 questions across five PRIME clusters. Designed to surface what you genuinely do — not what you aspire to do.
              </p>
              
              {/* Stats Cards */}
              <div style={{
                display:"flex", gap: 0,
                background:"rgba(255,255,255,0.025)", border:"1px solid rgba(255,255,255,0.06)",
                borderRadius: 10, overflow: "hidden", marginBottom: 48, maxWidth: 420,
              }}>
                {[
                  {label:"Questions", val:"55"},
                  {label:"Minutes", val:"18–28"},
                  {label:"Always", val:"Free"},
                ].map((s, i) => (
                  <div key={i} style={{
                    flex:1, padding:"18px 8px", textAlign:"center",
                    borderRight: i < 2 ? "1px solid rgba(255,255,255,0.06)" : "none",
                  }}>
                    <div style={{
                      fontSize: 24, fontWeight: 700, color: GOLD, lineHeight: 1,
                      fontFamily:"'Cormorant Garamond',Georgia,serif",
                    }}>{s.val}</div>
                    <div style={{fontSize: 10, color: "rgba(247,244,238,0.3)", marginTop: 6, letterSpacing: "0.08em"}}>{s.label}</div>
                  </div>
                ))}
              </div>
              
              {/* PRIME Clusters */}
              <div>
                <div style={{fontSize: 10, color: "rgba(201,168,76,0.35)", letterSpacing: "0.18em", marginBottom: 16}}>WHAT IS ASSESSED</div>
                <div style={{display:"flex", flexDirection:"column", gap: 10}}>
                  {CLUSTERS.map((c) => (
                    <div key={c.id} style={{
                      display:"flex", alignItems:"center", gap: 14,
                      padding:"12px 18px", background:"rgba(255,255,255,0.02)",
                      border: `1px solid ${c.color}20`, borderRadius: 10,
                    }}>
                      <div style={{
                        width: 38, height: 38, borderRadius: 8,
                        background: `${c.color}15`, border: `1px solid ${c.color}35`,
                        display:"flex", alignItems:"center", justifyContent:"center",
                        fontSize: 14, fontWeight: 700, color: c.color, flexShrink: 0,
                      }}>{c.id}</div>
                      <div style={{flex:1}}>
                        <div style={{fontSize: 15, color: PARCHMENT, fontWeight: 500}}>{c.name}</div>
                        <div style={{fontSize: 12, color: "rgba(247,244,238,0.3)", fontStyle:"italic"}}>{c.theme}</div>
                      </div>
                      <div style={{
                        fontSize: 12, color: `${c.color}70`,
                        letterSpacing: "0.06em", fontFamily:"'DM Mono',monospace",
                      }}>{Math.round(c.weight * 100)}%</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          
          {/* RIGHT COLUMN - Form Card (visible on both desktop and mobile) */}
          <div style={{
            flex: "1",
            width: isDesktop ? "auto" : "100%",
          }}>
            
            {/* Mobile-only Wordmark and Headline */}
            {!isDesktop && (
              <>
                <div style={{marginBottom: 32}}>
                  <div style={{
                    fontFamily:"'Cormorant Garamond',Georgia,serif",
                    fontSize: 28, fontWeight: 600, color: GOLD,
                    letterSpacing: "0.2em", lineHeight: 1, marginBottom: 4,
                  }}>VALORIA</div>
                  <div style={{fontSize: 9, color: "rgba(201,168,76,0.4)", letterSpacing: "0.3em"}}>INSTITUTE</div>
                </div>
                
                <div style={{
                  display:"inline-flex", alignItems:"center", gap: 8,
                  padding:"4px 12px", background:"rgba(201,168,76,0.08)",
                  border:"1px solid rgba(201,168,76,0.2)", borderRadius: 100,
                  marginBottom: 20,
                }}>
                  <div style={{width: 5, height: 5, borderRadius: "50%", background: GOLD}}/>
                  <span style={{fontSize: 9, fontWeight: 600, color: GOLD, letterSpacing: "0.2em"}}>FOUNDING COHORT — NOW OPEN</span>
                </div>
                
                <h1 style={{
                  fontFamily:"'Cormorant Garamond',Georgia,serif",
                  fontSize: "clamp(36px, 8vw, 52px)",
                  fontWeight: 300, lineHeight: 1.05, letterSpacing: "-0.025em",
                  color: PARCHMENT, margin: "0 0 16px",
                }}>
                  Know exactly<br/>where you <em style={{fontStyle:"italic", color: GOLD}}>stand.</em>
                </h1>
                
                <p style={{
                  fontSize: 15, fontWeight: 300, color: "rgba(247,244,238,0.5)",
                  lineHeight: 1.65, margin: "0 0 32px",
                }}>
                  55 questions across five PRIME clusters. Designed to surface what you genuinely do.
                </p>
                
                {/* Mobile Stats Row */}
                <div style={{
                  display:"flex", gap: 0, marginBottom: 32,
                  background:"rgba(255,255,255,0.025)", border:"1px solid rgba(255,255,255,0.06)",
                  borderRadius: 8, overflow: "hidden",
                }}>
                  {[
                    {label:"Questions", val:"55"},
                    {label:"Minutes", val:"18–28"},
                    {label:"Free", val:"Always"},
                  ].map((s, i) => (
                    <div key={i} style={{
                      flex:1, padding:"12px 8px", textAlign:"center",
                      borderRight: i < 2 ? "1px solid rgba(255,255,255,0.06)" : "none",
                    }}>
                      <div style={{fontSize: 18, fontWeight: 700, color: GOLD, lineHeight: 1}}>{s.val}</div>
                      <div style={{fontSize: 9, color: "rgba(247,244,238,0.3)", marginTop: 4}}>{s.label}</div>
                    </div>
                  ))}
                </div>
              </>
            )}
            
            {/* FORM CARD */}
            <div style={{
              background: "rgba(22,22,36,0.8)",
              border: "1px solid rgba(201,168,76,0.12)",
              borderRadius: 16,
              padding: isDesktop ? "32px" : "28px 24px",
              backdropFilter: "blur(4px)",
            }}>
              <div style={{
                fontSize: 11, fontWeight: 600, color: "rgba(247,244,238,0.4)",
                letterSpacing: "0.14em", marginBottom: 24,
              }}>BEFORE YOU BEGIN</div>
              
              {/* Name field */}
              <div style={{marginBottom: 20}}>
                <label style={{
                  fontSize: 10, fontWeight: 700, color: "rgba(201,168,76,0.5)",
                  letterSpacing: "0.22em", display: "block", marginBottom: 10,
                }}>YOUR FULL NAME</label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Full name"
                  style={{
                    width:"100%", background:"rgba(255,255,255,0.04)",
                    border: `1.5px solid ${name.trim() ? "rgba(201,168,76,0.4)" : "rgba(247,244,238,0.1)"}`,
                    borderRadius: 10, padding: "16px 18px",
                    color: PARCHMENT, fontSize: 16, outline: "none",
                    fontFamily: "'DM Sans', sans-serif", boxSizing: "border-box",
                  }}
                />
              </div>
              
              {/* Role field */}
              <div style={{marginBottom: 28}}>
                <label style={{
                  fontSize: 10, fontWeight: 700, color: "rgba(201,168,76,0.5)",
                  letterSpacing: "0.22em", display: "block", marginBottom: 10,
                }}>YOUR CURRENT ROLE</label>
                <input
                  value={role}
                  onChange={e => setRole(e.target.value)}
                  placeholder="e.g. Director of Strategy"
                  style={{
                    width:"100%", background:"rgba(255,255,255,0.04)",
                    border: `1.5px solid ${role.trim() ? "rgba(201,168,76,0.4)" : "rgba(247,244,238,0.1)"}`,
                    borderRadius: 10, padding: "16px 18px",
                    color: PARCHMENT, fontSize: 16, outline: "none",
                    fontFamily: "'DM Sans', sans-serif", boxSizing: "border-box",
                  }}
                />
              </div>
              
              {/* Begin Button */}
              <button
                onClick={() => { if (canBegin) setPhase("assessing"); }}
                disabled={!canBegin}
                style={{
                  width:"100%", padding:"18px 24px",
                  background: canBegin ? GOLD : "rgba(201,168,76,0.12)",
                  color: canBegin ? DARK : "rgba(201,168,76,0.25)",
                  border: canBegin ? "none" : "1px solid rgba(201,168,76,0.15)",
                  borderRadius: 10, fontSize: 12, fontWeight: 700,
                  letterSpacing: "0.18em", cursor: canBegin ? "pointer" : "not-allowed",
                  transition: "all 0.2s", fontFamily: "'DM Sans', sans-serif",
                  boxShadow: canBegin ? "0 4px 24px rgba(201,168,76,0.25)" : "none",
                }}
              >
                BEGIN THE VALU INDEX
              </button>
              
              {!canBegin && (
                <p style={{textAlign:"center", fontSize: 11, color: "rgba(247,244,238,0.2)", marginTop: 16}}>
                  Enter your name and role to continue
                </p>
              )}
              
              <p style={{textAlign:"center", fontSize: 11, color: "rgba(247,244,238,0.2)", marginTop: 20}}>
                Already have an account?{" "}
                <a href="https://valoriainstitute.com/login" style={{color: "rgba(201,168,76,0.6)", textDecoration: "none"}}>Sign in</a>
              </p>
            </div>
            
            {/* Mobile-only PRIME Clusters (collapsible section) */}
            {!isDesktop && (
              <div style={{marginTop: 24}}>
                <div style={{fontSize: 10, color: "rgba(201,168,76,0.35)", letterSpacing: "0.18em", marginBottom: 14}}>WHAT IS ASSESSED</div>
                <div style={{display:"flex", flexDirection:"column", gap: 8}}>
                  {CLUSTERS.map((c) => (
                    <div key={c.id} style={{
                      display:"flex", alignItems:"center", gap: 12,
                      padding:"10px 14px", background:"rgba(255,255,255,0.02)",
                      border: `1px solid ${c.color}20`, borderRadius: 8,
                    }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 6,
                        background: `${c.color}15`, border: `1px solid ${c.color}35`,
                        display:"flex", alignItems:"center", justifyContent:"center",
                        fontSize: 12, fontWeight: 700, color: c.color, flexShrink: 0,
                      }}>{c.id}</div>
                      <div style={{flex:1}}>
                        <div style={{fontSize: 13, color: PARCHMENT, fontWeight: 500}}>{c.name}</div>
                        <div style={{fontSize: 10, color: "rgba(247,244,238,0.3)", fontStyle:"italic"}}>{c.theme}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Footer Note */}
            <div style={{
              marginTop: 24, paddingTop: 20,
              borderTop: "1px solid rgba(201,168,76,0.08)",
              display:"flex", gap: 16, flexWrap:"wrap", justifyContent:"center",
            }}>
              {["Always free", "18–28 minutes", "NDPA 2023 compliant"].map(t => (
                <div key={t} style={{display:"flex", alignItems:"center", gap: 6, fontSize: 11, color: "rgba(247,244,238,0.2)"}}>
                  <div style={{width: 3, height: 3, borderRadius: "50%", background: "rgba(201,168,76,0.4)"}}/>
                  {t}
                </div>
              ))}
            </div>
          </div>
        </div>
        
        {/* Keyframe Animations */}
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=DM+Sans:wght@300;400;500;700&family=DM+Mono:wght@400&display=swap');
          
          @keyframes pulseGold {
            0%, 100% { opacity: 0.6; transform: scale(1); }
            50% { opacity: 1; transform: scale(1.1); }
          }
          
          input:focus {
            border-color: rgba(201,168,76,0.5) !important;
            box-shadow: 0 0 0 3px rgba(201,168,76,0.08);
          }
          
          input::placeholder {
            color: rgba(247,244,238,0.2) !important;
          }
          
          * {
            -webkit-tap-highlight-color: transparent;
          }
        `}</style>
      </div>
    );
  }
  
  // Rest of your component (assessment screen, report screen, etc.)
  // Keep all your existing code for the assessment phase, report generation,
  // signup flow, and everything else unchanged.
  
  return null;
}