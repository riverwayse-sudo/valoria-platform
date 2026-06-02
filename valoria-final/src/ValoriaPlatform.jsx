        {/* ── TWO COLUMN DESKTOP / SINGLE COLUMN MOBILE LAYOUT ── */}
        <div style={{
          position:"relative", zIndex:1,
          maxWidth: isDesktop ? 1200 : 520,
          margin:"0 auto",
          padding: isDesktop ? "72px 48px" : "clamp(48px,10vw,72px) 20px clamp(40px,8vw,64px)",
          display:"flex",
          flexDirection: isDesktop ? "row" : "column",
          alignItems: "flex-start",
          gap: isDesktop ? 64 : 0,
          width: "100%",
          boxSizing: "border-box",
        }}>
          {/* LEFT COLUMN — desktop only */}
          <div style={{
            display: isDesktop ? "block" : "none",
            flex: "1.2",
            width: isDesktop ? "auto" : "100%",
          }}> 
            {/* Wordmark */}
            <div style={{marginBottom:48}}>
              <div style={{fontFamily:"'Cormorant Garamond',Georgia,serif",fontSize:32,fontWeight:600,color:GOLD,letterSpacing:"0.2em",lineHeight:1,marginBottom:3}}>VALORIA</div>
              <div style={{fontSize:9,color:"rgba(201,168,76,0.4)",letterSpacing:"0.3em"}}>INSTITUTE</div>
            </div>
            {/* Badge */}
            <div style={{display:"inline-flex",alignItems:"center",gap:8,padding:"5px 12px",background:"rgba(201,168,76,0.08)",border:"1px solid rgba(201,168,76,0.2)",borderRadius:100,marginBottom:24}}>
              <div style={{width:6,height:6,borderRadius:"50%",background:GOLD,animation:"pulseGold 2.5s ease infinite"}}/>
              <span style={{fontSize:9,fontWeight:600,color:GOLD,letterSpacing:"0.2em"}}>FOUNDING COHORT — NOW OPEN</span>
            </div>
            {/* Headline */}
            <h1 style={{fontFamily:"'Cormorant Garamond',Georgia,serif",fontSize:"clamp(52px,5vw,72px)",fontWeight:300,lineHeight:0.95,letterSpacing:"-0.025em",color:PARCHMENT,margin:"0 0 24px"}}>
              Know exactly<br/>where you <em style={{fontStyle:"italic",color:GOLD}}>stand.</em>
            </h1>
            <p style={{fontSize:17,fontWeight:300,color:"rgba(247,244,238,0.5)",lineHeight:1.75,margin:"0 0 48px",maxWidth:480}}>
              55 questions across five PRIME clusters. Designed to surface what you genuinely do — not what you aspire to do.
            </p>
            {/* Stats */}
            <div style={{display:"flex",gap:0,background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:8,overflow:"hidden",marginBottom:48,maxWidth:420}}>
              {[{label:"Questions",val:"55"},{label:"Minutes",val:"18–28"},{label:"Always",val:"Free"}].map((s,i)=>(
                <div key={i} style={{flex:1,padding:"20px 8px",textAlign:"center",borderRight:i<2?"1px solid rgba(255,255,255,0.06)":"none"}}>
                  <div style={{fontSize:22,fontWeight:700,color:GOLD,lineHeight:1,fontFamily:"'Cormorant Garamond',Georgia,serif"}}>{s.val}</div>
                  <div style={{fontSize:10,color:"rgba(247,244,238,0.3)",marginTop:5,letterSpacing:"0.08em"}}>{s.label}</div>
                </div>
              ))}
            </div>
            {/* PRIME Clusters */}
            <div style={{marginBottom:8}}>
              <div style={{fontSize:9,color:"rgba(201,168,76,0.35)",letterSpacing:"0.18em",marginBottom:16}}>WHAT IS ASSESSED</div>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {CLUSTERS.map((c,i)=>(
                  <div key={c.id} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",background:"rgba(255,255,255,0.02)",border:`1px solid ${c.color}20`,borderRadius:8}}>
                    <div style={{width:34,height:34,borderRadius:6,background:`${c.color}15`,border:`1px solid ${c.color}35`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color:c.color,flexShrink:0}}>{c.id}</div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:14,color:PARCHMENT,fontWeight:500}}>{c.name}</div>
                      <div style={{fontSize:12,color:"rgba(247,244,238,0.3)",fontStyle:"italic"}}>{c.theme}</div>
                    </div>
                    <div style={{fontSize:11,color:`${c.color}70`,letterSpacing:"0.06em",fontFamily:"'DM Mono',monospace"}}>{Math.round(c.weight*100)}%</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN — form (always visible) */}
          <div style={{
            flex: isDesktop ? "1" : "unset", 
            width: isDesktop ? "auto" : "100%",
            position: isDesktop ? "sticky" : "static", 
            top: isDesktop ? 40 : "auto"
          }}>
            {/* REST OF YOUR RIGHT COLUMN CONTENT - WORDMARK mobile, HERO mobile, FORM CARD, etc. */}
            {/* Copy this exactly as it appears in your current file from line ~1530 to ~1670 */}
          </div>
        </div>