if (phase === "intro") {
  const canBegin = name.trim().length > 0 && role.trim().length > 0;
  
  return (
    <div style={{minHeight:"100vh", background:DARK, fontFamily:"'DM Sans',sans-serif", position:"relative", overflowX:"hidden"}}>
      {/* Background effects - keep as is */}
      <div style={{position:"fixed", inset:0, pointerEvents:"none", zIndex:0, opacity:0.035, backgroundImage:`url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`, backgroundSize:"256px"}}/>
      <div style={{position:"fixed", inset:0, pointerEvents:"none", zIndex:0, background:"radial-gradient(ellipse 100% 50% at 50% 0%, rgba(201,168,76,0.09) 0%, transparent 60%)"}}/>
      <div style={{position:"fixed", top:0, left:0, right:0, height:3, display:"flex", zIndex:10}}>
        {[["#1D9E75",20],["#378ADD",25],["#7F77DD",25],["#BA7517",20],["#D85A30",10]].map(([c,p],i)=>(
          <div key={i} style={{flex:p, background:c, opacity:0.9}}/>
        ))}
      </div>

      {/* MAIN CONTAINER - PURE INLINE STYLES WITH CONDITIONAL RENDERING */}
      <div style={{
        position:"relative", zIndex:1,
        maxWidth: isDesktop ? 1400 : 600,
        margin:"0 auto",
        padding: isDesktop ? "60px 48px" : "40px 20px",
        display: "flex",
        flexDirection: isDesktop ? "row" : "column",
        gap: isDesktop ? 80 : 0,
      }}>
        
        {/* LEFT COLUMN - ONLY RENDER ON DESKTOP */}
        {isDesktop && (
          <div style={{flex: "1.2", paddingRight: 20}}>
            {/* Wordmark */}
            <div style={{marginBottom: 40}}>
              <div style={{fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize: 34, fontWeight: 600, color: GOLD, letterSpacing: "0.22em", lineHeight: 1, marginBottom: 4}}>VALORIA</div>
              <div style={{fontSize: 9, color: "rgba(201,168,76,0.4)", letterSpacing: "0.3em"}}>INSTITUTE</div>
            </div>
            
            {/* Badge */}
            <div style={{display:"inline-flex", alignItems:"center", gap: 8, padding:"5px 14px", background:"rgba(201,168,76,0.08)", border:"1px solid rgba(201,168,76,0.2)", borderRadius: 100, marginBottom: 28}}>
              <div style={{width: 6, height: 6, borderRadius: "50%", background: GOLD}}/>
              <span style={{fontSize: 9, fontWeight: 600, color: GOLD, letterSpacing: "0.2em"}}>FOUNDING COHORT — NOW OPEN</span>
            </div>
            
            {/* Headline */}
            <h1 style={{fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:"clamp(48px,5vw,68px)", fontWeight: 300, lineHeight: 1, letterSpacing: "-0.02em", color: PARCHMENT, margin: "0 0 20px"}}>
              Know exactly<br/>where you <em style={{fontStyle:"italic", color: GOLD}}>stand.</em>
            </h1>
            
            <p style={{fontSize: 16, fontWeight: 300, color: "rgba(247,244,238,0.5)", lineHeight: 1.75, margin: "0 0 40px", maxWidth: 460}}>
              55 questions across five PRIME clusters. Designed to surface what you genuinely do — not what you aspire to do.
            </p>
            
            {/* Stats */}
            <div style={{display:"flex", gap: 0, background:"rgba(255,255,255,0.025)", border:"1px solid rgba(255,255,255,0.06)", borderRadius: 10, overflow: "hidden", marginBottom: 40, maxWidth: 400}}>
              {[{l:"Questions",v:"55"},{l:"Minutes",v:"18–28"},{l:"Always",v:"Free"}].map((s,i)=>(
                <div key={i} style={{flex:1, padding:"18px 8px", textAlign:"center", borderRight: i<2 ? "1px solid rgba(255,255,255,0.06)" : "none"}}>
                  <div style={{fontSize: 22, fontWeight: 700, color: GOLD, lineHeight: 1, fontFamily:"'Cormorant Garamond',Georgia,serif"}}>{s.v}</div>
                  <div style={{fontSize: 10, color: "rgba(247,244,238,0.3)", marginTop: 5, letterSpacing: "0.06em"}}>{s.l}</div>
                </div>
              ))}
            </div>
            
            {/* PRIME Clusters */}
            <div>
              <div style={{fontSize: 9, color: "rgba(201,168,76,0.35)", letterSpacing: "0.18em", marginBottom: 14}}>WHAT IS ASSESSED</div>
              <div style={{display:"flex", flexDirection:"column", gap: 8}}>
                {CLUSTERS.map(c=>(
                  <div key={c.id} style={{display:"flex", alignItems:"center", gap: 12, padding:"12px 16px", background:"rgba(255,255,255,0.02)", border:`1px solid ${c.color}22`, borderRadius: 10}}>
                    <div style={{width: 36, height: 36, borderRadius: 8, background:`${c.color}15`, border:`1px solid ${c.color}35`, display:"flex", alignItems:"center", justifyContent:"center", fontSize: 13, fontWeight: 700, color: c.color, flexShrink: 0}}>{c.id}</div>
                    <div style={{flex:1}}>
                      <div style={{fontSize: 14, color: PARCHMENT, fontWeight: 500}}>{c.name}</div>
                      <div style={{fontSize: 11, color: "rgba(247,244,238,0.3)", fontStyle:"italic"}}>{c.theme}</div>
                    </div>
                    <div style={{fontSize: 11, color: `${c.color}70`, letterSpacing: "0.06em"}}>{Math.round(c.weight*100)}%</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        
        {/* RIGHT COLUMN - ALWAYS VISIBLE */}
        <div style={{flex: isDesktop ? 1 : "unset", width: isDesktop ? "auto" : "100%"}}>
          
          {/* Mobile-only header */}
          {!isDesktop && (
            <>
              <div style={{marginBottom: 28}}>
                <div style={{fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize: 26, fontWeight: 600, color: GOLD, letterSpacing: "0.2em", lineHeight: 1, marginBottom: 3}}>VALORIA</div>
                <div style={{fontSize: 9, color: "rgba(201,168,76,0.4)", letterSpacing: "0.3em", marginBottom: 16}}>INSTITUTE</div>
                <div style={{display:"inline-flex", alignItems:"center", gap: 7, padding:"4px 12px", background:"rgba(201,168,76,0.08)", border:"1px solid rgba(201,168,76,0.2)", borderRadius: 100, marginBottom: 18}}>
                  <div style={{width: 5, height: 5, borderRadius: "50%", background: GOLD}}/>
                  <span style={{fontSize: 9, fontWeight: 600, color: GOLD, letterSpacing: "0.18em"}}>FOUNDING COHORT — NOW OPEN</span>
                </div>
                <h1 style={{fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:"clamp(34px,8vw,48px)", fontWeight: 300, lineHeight: 1.05, color: PARCHMENT, margin: "0 0 12px"}}>
                  Know exactly<br/>where you <em style={{fontStyle:"italic", color: GOLD}}>stand.</em>
                </h1>
                <p style={{fontSize: 14, color: "rgba(247,244,238,0.45)", lineHeight: 1.65, margin: "0 0 24px"}}>55 questions across five PRIME clusters.</p>
                <div style={{display:"flex", gap: 0, marginBottom: 28, background:"rgba(255,255,255,0.025)", border:"1px solid rgba(255,255,255,0.06)", borderRadius: 8, overflow: "hidden"}}>
                  {[{l:"Questions",v:"55"},{l:"Minutes",v:"18–28"},{l:"Free",v:"Always"}].map((s,i)=>(
                    <div key={i} style={{flex:1, padding:"12px 6px", textAlign:"center", borderRight: i<2 ? "1px solid rgba(255,255,255,0.06)" : "none"}}>
                      <div style={{fontSize: 18, fontWeight: 700, color: GOLD}}>{s.v}</div>
                      <div style={{fontSize: 9, color: "rgba(247,244,238,0.3)", marginTop: 4}}>{s.l}</div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
          
          {/* FORM CARD */}
          <div style={{background:"rgba(20,20,34,0.9)", border:"1px solid rgba(201,168,76,0.12)", borderRadius: 14, padding:"28px 24px"}}>
            <div style={{fontSize: 10, fontWeight: 600, color: "rgba(247,244,238,0.35)", letterSpacing: "0.16em", marginBottom: 20}}>BEFORE YOU BEGIN</div>
            
            <div style={{marginBottom: 16}}>
              <label style={{fontSize: 10, fontWeight: 700, color: "rgba(201,168,76,0.5)", letterSpacing: "0.2em", display: "block", marginBottom: 8}}>YOUR FULL NAME</label>
              <input value={name} onChange={e=>setName(e.target.value)} placeholder="Full name"
                style={{width:"100%", background:"rgba(255,255,255,0.04)", border:`1.5px solid ${name.trim()?"rgba(201,168,76,0.4)":"rgba(247,244,238,0.1)"}`, borderRadius:10, padding:"15px 16px", color:PARCHMENT, fontSize:16, fontFamily:"'DM Sans',sans-serif", boxSizing:"border-box"}}/>
            </div>
            
            <div style={{marginBottom: 24}}>
              <label style={{fontSize: 10, fontWeight: 700, color: "rgba(201,168,76,0.5)", letterSpacing: "0.2em", display: "block", marginBottom: 8}}>YOUR CURRENT ROLE</label>
              <input value={role} onChange={e=>setRole(e.target.value)} placeholder="e.g. Director of Strategy"
                style={{width:"100%", background:"rgba(255,255,255,0.04)", border:`1.5px solid ${role.trim()?"rgba(201,168,76,0.4)":"rgba(247,244,238,0.1)"}`, borderRadius:10, padding:"15px 16px", color:PARCHMENT, fontSize:16, fontFamily:"'DM Sans',sans-serif", boxSizing:"border-box"}}/>
            </div>
            
            <button onClick={()=>{if(canBegin)setPhase("assessing");}} disabled={!canBegin}
              style={{width:"100%", padding:"17px 24px", background:canBegin?GOLD:"rgba(201,168,76,0.1)", color:canBegin?DARK:"rgba(201,168,76,0.3)", border:canBegin?"none":"1px solid rgba(201,168,76,0.15)", borderRadius:10, fontSize:12, fontWeight:700, letterSpacing:"0.18em", cursor:canBegin?"pointer":"not-allowed", fontFamily:"'DM Sans',sans-serif"}}>
              BEGIN THE VALU INDEX
            </button>
            
            {!canBegin && <p style={{textAlign:"center", fontSize:11, color:"rgba(247,244,238,0.2)", marginTop:12}}>Enter your name and role to continue</p>}
            <p style={{textAlign:"center", fontSize:11, color:"rgba(247,244,238,0.2)", marginTop:16}}>
              Already have an account?{" "}
              <a href="https://valoriainstitute.com/login" style={{color:"rgba(201,168,76,0.6)", textDecoration:"none"}}>Sign in</a>
            </p>
          </div>
          
          {/* Mobile clusters */}
          {!isDesktop && (
            <div style={{marginTop: 20}}>
              <div style={{fontSize: 9, color: "rgba(201,168,76,0.35)", letterSpacing: "0.18em", marginBottom: 12}}>WHAT IS ASSESSED</div>
              <div style={{display:"flex", flexDirection:"column", gap: 7}}>
                {CLUSTERS.map(c=>(
                  <div key={c.id} style={{display:"flex", alignItems:"center", gap: 10, padding:"10px 12px", background:"rgba(255,255,255,0.02)", border:`1px solid ${c.color}20`, borderRadius:8}}>
                    <div style={{width:30, height:30, borderRadius:6, background:`${c.color}15`, border:`1px solid ${c.color}35`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700, color:c.color, flexShrink:0}}>{c.id}</div>
                    <div><div style={{fontSize:13, color:PARCHMENT, fontWeight:500}}>{c.name}</div><div style={{fontSize:10, color:"rgba(247,244,238,0.3)", fontStyle:"italic"}}>{c.theme}</div></div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Footer */}
          <div style={{marginTop:20, paddingTop:16, borderTop:"1px solid rgba(201,168,76,0.08)", display:"flex", gap:12, flexWrap:"wrap", justifyContent:"center"}}>
            {["Always free","18–28 minutes","NDPA 2023 compliant"].map(t=>(
              <div key={t} style={{display:"flex", alignItems:"center", gap:5, fontSize:10, color:"rgba(247,244,238,0.2)"}}>
                <div style={{width:3, height:3, borderRadius:"50%", background:"rgba(201,168,76,0.4)"}}/>
                {t}
              </div>
            ))}
          </div>
        </div>
      </div>
      
      <style>{`
        @keyframes pulseGold { 0%,100%{opacity:.6;transform:scale(1)} 50%{opacity:1;transform:scale(1.1)} }
        input:focus { border-color: rgba(201,168,76,0.5) !important; box-shadow: 0 0 0 3px rgba(201,168,76,0.08) !important; outline: none !important; }
        input::placeholder { color: rgba(247,244,238,0.2) !important; }
      `}</style>
    </div>
  );
}