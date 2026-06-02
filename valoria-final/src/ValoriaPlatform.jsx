// ── INTRO SCREEN WITH FORCED TWO-COLUMN LAYOUT ──────────────────────────
if (phase === "intro") {
  const canBegin = name.trim().length > 0 && role.trim().length > 0;
  
  // Use CSS media query instead of JS for reliability
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
      
      <div style={{
        position:"fixed", inset:0, pointerEvents:"none", zIndex:0,
        background:"radial-gradient(ellipse 100% 50% at 50% 0%, rgba(201,168,76,0.09) 0%, transparent 60%)",
      }}/>
      
      <div style={{position:"fixed",top:0,left:0,right:0,height:3,display:"flex",zIndex:10}}>
        {[["#1D9E75",20],["#378ADD",25],["#7F77DD",25],["#BA7517",20],["#D85A30",10]].map(([color,pct],i)=>(
          <div key={i} style={{flex:pct,background:color,opacity:0.9}}/>
        ))}
      </div>

      {/* CSS Media Query for two-column layout - THIS IS THE KEY FIX */}
      <style>{`
        @media (min-width: 900px) {
          .two-column-container {
            display: flex !important;
            flex-direction: row !important;
            max-width: 1400px !important;
            margin: 0 auto !important;
            padding: 60px 48px !important;
            gap: 80px !important;
          }
          .left-column {
            display: block !important;
            flex: 1.2 !important;
            padding-right: 20px !important;
          }
          .right-column {
            flex: 1 !important;
            position: sticky !important;
            top: 40px !important;
          }
          .mobile-only {
            display: none !important;
          }
        }
        
        @media (max-width: 899px) {
          .two-column-container {
            display: flex !important;
            flex-direction: column !important;
            padding: 40px 20px !important;
          }
          .left-column {
            display: none !important;
          }
          .desktop-only {
            display: none !important;
          }
          .right-column {
            width: 100% !important;
          }
        }
        
        @keyframes pulseGold {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.1); }
        }
        
        input:focus {
          border-color: rgba(201,168,76,0.5) !important;
          box-shadow: 0 0 0 3px rgba(201,168,76,0.08) !important;
        }
        
        input::placeholder {
          color: rgba(247,244,238,0.2) !important;
        }
      `}</style>
      
      {/* TWO COLUMN CONTAINER - using CSS classes, not inline styles */}
      <div className="two-column-container" style={{
        position:"relative", zIndex:1,
      }}>
        
        {/* LEFT COLUMN - Desktop only */}
        <div className="left-column desktop-only">
          <div style={{marginBottom: 48}}>
            <div style={{
              fontFamily:"'Cormorant Garamond',Georgia,serif",
              fontSize: 36, fontWeight: 600, color: GOLD,
              letterSpacing: "0.2em", lineHeight: 1, marginBottom: 4,
            }}>VALORIA</div>
            <div style={{fontSize: 10, color: "rgba(201,168,76,0.4)", letterSpacing: "0.3em"}}>INSTITUTE</div>
          </div>
          
          <div style={{
            display:"inline-flex", alignItems:"center", gap: 8,
            padding:"5px 14px", background:"rgba(201,168,76,0.08)",
            border:"1px solid rgba(201,168,76,0.2)", borderRadius: 100,
            marginBottom: 28,
          }}>
            <div style={{width: 6, height: 6, borderRadius: "50%", background: GOLD}}/>
            <span style={{fontSize: 10, fontWeight: 600, color: GOLD, letterSpacing: "0.2em"}}>FOUNDING COHORT — NOW OPEN</span>
          </div>
          
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
          
          <div style={{
            display:"flex", gap: 0,
            background:"rgba(255,255,255,0.025)", border:"1px solid rgba(255,255,255,0.06)",
            borderRadius: 10, overflow: "hidden", marginBottom: 48, maxWidth: 420,
          }}>
            {[{label:"Questions", val:"55"},{label:"Minutes", val:"18–28"},{label:"Always", val:"Free"}].map((s, i) => (
              <div key={i} style={{
                flex:1, padding:"18px 8px", textAlign:"center",
                borderRight: i < 2 ? "1px solid rgba(255,255,255,0.06)" : "none",
              }}>
                <div style={{fontSize: 24, fontWeight: 700, color: GOLD, lineHeight: 1}}>{s.val}</div>
                <div style={{fontSize: 10, color: "rgba(247,244,238,0.3)", marginTop: 6}}>{s.label}</div>
              </div>
            ))}
          </div>
          
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
                  <div style={{fontSize: 12, color: `${c.color}70`, letterSpacing: "0.06em"}}>{Math.round(c.weight * 100)}%</div>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        {/* RIGHT COLUMN - Form */}
        <div className="right-column">
          
          {/* Mobile-only content */}
          <div className="mobile-only">
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
              fontWeight: 300, lineHeight: 1.05,
              color: PARCHMENT, margin: "0 0 16px",
            }}>
              Know exactly<br/>where you <em style={{fontStyle:"italic", color: GOLD}}>stand.</em>
            </h1>
            
            <p style={{
              fontSize: 15, fontWeight: 300, color: "rgba(247,244,238,0.5)",
              lineHeight: 1.65, margin: "0 0 32px",
            }}>
              55 questions across five PRIME clusters.
            </p>
            
            <div style={{
              display:"flex", gap: 0, marginBottom: 32,
              background:"rgba(255,255,255,0.025)", border:"1px solid rgba(255,255,255,0.06)",
              borderRadius: 8, overflow: "hidden",
            }}>
              {[{label:"Questions", val:"55"},{label:"Minutes", val:"18–28"},{label:"Free", val:"Always"}].map((s, i) => (
                <div key={i} style={{
                  flex:1, padding:"12px 8px", textAlign:"center",
                  borderRight: i < 2 ? "1px solid rgba(255,255,255,0.06)" : "none",
                }}>
                  <div style={{fontSize: 18, fontWeight: 700, color: GOLD}}>{s.val}</div>
                  <div style={{fontSize: 9, color: "rgba(247,244,238,0.3)", marginTop: 4}}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
          
          {/* FORM CARD */}
          <div style={{
            background: "rgba(22,22,36,0.8)",
            border: "1px solid rgba(201,168,76,0.12)",
            borderRadius: 16,
            padding: "32px",
          }}>
            <div style={{
              fontSize: 11, fontWeight: 600, color: "rgba(247,244,238,0.4)",
              letterSpacing: "0.14em", marginBottom: 24,
            }}>BEFORE YOU BEGIN</div>
            
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
                fontFamily: "'DM Sans', sans-serif",
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
          
          {/* Mobile-only PRIME Clusters */}
          <div className="mobile-only" style={{marginTop: 24}}>
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
    </div>
  );
}