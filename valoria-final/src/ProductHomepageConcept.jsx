import React from 'react';

const navy = '#0F0F1A';
const ink = '#171722';
const gold = '#C9A84C';
const cream = '#F7F4EE';
const muted = '#6F6D76';

const journeys = [
  { n: '01', title: 'Assess yourself', body: 'Start with the 15-question VALU Snapshot and see your directional PRIME profile.', cta: 'Take the VALU Snapshot', dark: true },
  { n: '02', title: 'Be discovered', body: 'Build one professional identity that can power your candidate, speaker or facilitator presence.', cta: 'Build your profile' },
  { n: '03', title: 'Find talent', body: 'Discover assessed professionals through a clearer, more trusted marketplace experience.', cta: 'Explore the Bureau' },
  { n: '04', title: 'Develop your team', body: 'Measure capability, target development and reassess movement over a defined cycle.', cta: 'Explore Develop' },
];

const pillars = [
  ['ASSESS', 'VALU Index', 'A structured view of professional capability across the PRIME framework.'],
  ['UNDERSTAND', 'PRIME', 'A common language for Presence, Relationships, Intelligence, Mastery and Enterprise.'],
  ['CONNECT', 'Marketplace', 'One assessed identity designed to help buyers discover the right professional.'],
  ['DEVELOP', 'Valoria Develop', 'Turn capability gaps into targeted development and measurable movement.'],
];

export default function ProductHomepageConcept() {
  const go = id => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  return (
    <div style={{ minHeight: '100vh', background: cream, color: ink, fontFamily: 'Raleway, sans-serif' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Raleway:wght@300;400;500;600;700&display=swap');
      *{box-sizing:border-box}html{scroll-behavior:smooth}button,a{font:inherit}a{text-decoration:none}.hp-link:hover{color:${gold}!important}.journey:hover{transform:translateY(-4px);box-shadow:0 18px 45px rgba(15,15,26,.10)}.journey{transition:.25s ease}.arrow{transition:transform .2s}.journey:hover .arrow{transform:translateX(5px)}
      @media(max-width:800px){.navlinks{display:none!important}.hero-grid,.journeys,.pillars,.proof-grid,.footer-grid{grid-template-columns:1fr!important}.hero{padding-top:120px!important}.hero-title{font-size:54px!important}.journeys{gap:12px!important}.journey{min-height:auto!important}.section{padding:72px 22px!important}}
      `}</style>

      <div style={{ height: 3, display:'flex' }}><div style={{flex:20,background:'#516A86'}}/><div style={{flex:25,background:'#5D8065'}}/><div style={{flex:25,background:'#8A7A45'}}/><div style={{flex:20,background:'#6E5B7A'}}/><div style={{flex:10,background:'#A86A48'}}/></div>
      <nav style={{height:72,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 clamp(22px,5vw,72px)',background:'rgba(247,244,238,.96)',borderBottom:'1px solid rgba(15,15,26,.08)',position:'sticky',top:0,zIndex:20,backdropFilter:'blur(12px)'}}>
        <div style={{fontWeight:700,letterSpacing:'.12em',fontSize:14}}>VALORIA <span style={{fontWeight:400,color:gold}}>INSTITUTE</span></div>
        <div className="navlinks" style={{display:'flex',gap:30,alignItems:'center',fontSize:12,letterSpacing:'.06em',textTransform:'uppercase'}}>
          <a className="hp-link" href="#platform" style={{color:muted}}>Platform</a><a className="hp-link" href="#marketplace" style={{color:muted}}>Marketplace</a><a className="hp-link" href="#events" style={{color:muted}}>Events</a><a className="hp-link" href="#about" style={{color:muted}}>About</a>
          <button onClick={()=>go('start')} style={{border:0,background:gold,color:navy,padding:'12px 18px',fontWeight:700,fontSize:11,letterSpacing:'.08em',cursor:'pointer'}}>START WITH VALU</button>
        </div>
      </nav>

      <main>
        <section className="hero" style={{background:navy,color:cream,padding:'110px clamp(22px,7vw,100px) 90px',position:'relative',overflow:'hidden'}}>
          <div style={{position:'absolute',right:'-12%',top:'8%',width:520,height:520,border:'1px solid rgba(201,168,76,.18)',borderRadius:'50%'}}/><div style={{position:'absolute',right:'-4%',top:'18%',width:360,height:360,border:'1px solid rgba(201,168,76,.12)',borderRadius:'50%'}}/>
          <div className="hero-grid" style={{maxWidth:1240,margin:'0 auto',display:'grid',gridTemplateColumns:'1.15fr .85fr',gap:80,alignItems:'center',position:'relative'}}>
            <div>
              <div style={{fontFamily:'DM Mono',fontSize:10,letterSpacing:'.22em',color:gold,marginBottom:28}}>PROFESSIONAL INFRASTRUCTURE · VALORIA INSTITUTE</div>
              <h1 className="hero-title" style={{fontSize:'clamp(54px,7vw,94px)',lineHeight:.96,fontWeight:300,letterSpacing:'-.045em',margin:'0 0 30px',maxWidth:820}}>Know your worth.<br/><span style={{color:gold}}>Build what proves it.</span></h1>
              <p style={{fontSize:18,lineHeight:1.75,color:'rgba(247,244,238,.66)',maxWidth:650,margin:'0 0 38px'}}>Valoria connects professional assessment, development and opportunity through one trusted identity.</p>
              <div style={{display:'flex',gap:12,flexWrap:'wrap'}}><button onClick={()=>go('start')} style={{background:gold,color:navy,border:0,padding:'16px 23px',fontWeight:700,fontSize:12,letterSpacing:'.08em',cursor:'pointer'}}>TAKE THE VALU SNAPSHOT <span className="arrow">→</span></button><button onClick={()=>go('marketplace')} style={{background:'transparent',color:cream,border:'1px solid rgba(247,244,238,.22)',padding:'15px 22px',fontSize:12,letterSpacing:'.08em',cursor:'pointer'}}>EXPLORE THE MARKETPLACE</button></div>
              <div style={{marginTop:34,fontFamily:'DM Mono',fontSize:10,color:'rgba(247,244,238,.38)',letterSpacing:'.08em'}}>15 QUESTIONS · DIRECTIONAL · FREE TO START</div>
            </div>
            <div style={{justifySelf:'end',width:'min(100%,430px)'}}>
              <div style={{border:'1px solid rgba(201,168,76,.25)',background:'rgba(247,244,238,.035)',padding:28,position:'relative'}}>
                <div style={{fontFamily:'DM Mono',fontSize:9,color:gold,letterSpacing:'.18em',marginBottom:24}}>THE VALORIA JOURNEY</div>
                {['Assess','Understand','Connect','Develop'].map((x,i)=><div key={x} style={{display:'flex',gap:16,alignItems:'center',padding:'17px 0',borderTop:i===0?'1px solid rgba(247,244,238,.10)':'1px solid rgba(247,244,238,.08)'}}><div style={{fontFamily:'DM Mono',fontSize:10,color:gold}}>0{i+1}</div><div><div style={{fontSize:17,fontWeight:500}}>{x}</div><div style={{fontSize:11,color:'rgba(247,244,238,.42)',marginTop:4}}>{['VALU Index','PRIME framework','Marketplace identity','Targeted development'][i]}</div></div></div>)}
                <div style={{marginTop:20,paddingTop:18,borderTop:'1px solid rgba(201,168,76,.2)',fontSize:11,color:'rgba(247,244,238,.48)',lineHeight:1.7}}>One system. One professional identity. Multiple ways to create value.</div>
              </div>
            </div>
          </div>
        </section>

        <section id="start" className="section" style={{padding:'92px clamp(22px,7vw,100px)',background:'#fff'}}>
          <div style={{maxWidth:1240,margin:'0 auto'}}><div style={{fontFamily:'DM Mono',fontSize:10,color:gold,letterSpacing:'.18em',marginBottom:18}}>CHOOSE YOUR NEXT MOVE</div><h2 style={{fontSize:'clamp(36px,5vw,60px)',fontWeight:400,letterSpacing:'-.035em',margin:'0 0 16px'}}>What brings you to Valoria?</h2><p style={{color:muted,maxWidth:650,lineHeight:1.8,marginBottom:42}}>Don't learn the whole institution before you can use it. Start with the outcome you want.</p>
            <div className="journeys" style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:16}}>{journeys.map(j=><div key={j.n} className="journey" style={{padding:26,border:'1px solid rgba(15,15,26,.10)',background:j.dark?navy:'#FAF8F3',color:j.dark?cream:ink,minHeight:300,display:'flex',flexDirection:'column'}}><div style={{fontFamily:'DM Mono',fontSize:10,color:j.dark?gold:muted,marginBottom:34}}>{j.n}</div><h3 style={{fontSize:23,fontWeight:500,margin:'0 0 13px'}}>{j.title}</h3><p style={{fontSize:13,lineHeight:1.75,color:j.dark?'rgba(247,244,238,.58)':muted,margin:0}}>{j.body}</p><a href={j.n==='03'?'#marketplace':'#'} onClick={e=>{if(j.n!=='03')e.preventDefault();}} style={{marginTop:'auto',paddingTop:28,color:j.dark?gold:ink,fontSize:11,fontWeight:700,letterSpacing:'.08em'}}> {j.cta} <span className="arrow">→</span></a></div>)}</div>
          </div>
        </section>

        <section id="platform" className="section" style={{padding:'100px clamp(22px,7vw,100px)',background:'#F0EEE8'}}>
          <div style={{maxWidth:1240,margin:'0 auto'}}><div style={{display:'grid',gridTemplateColumns:'.8fr 1.2fr',gap:80,alignItems:'start'}} className="hero-grid"><div><div style={{fontFamily:'DM Mono',fontSize:10,color:gold,letterSpacing:'.18em',marginBottom:18}}>THE SYSTEM</div><h2 style={{fontSize:'clamp(38px,5vw,62px)',fontWeight:400,letterSpacing:'-.04em',margin:0}}>From capability<br/>to opportunity.</h2></div><p style={{fontSize:17,lineHeight:1.9,color:muted,maxWidth:620,margin:0}}>Valoria is not another directory, course platform or personality quiz. It is a professional infrastructure layer designed to make capability easier to understand, develop and connect to real opportunity.</p></div>
            <div className="pillars" style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:1,background:'rgba(15,15,26,.10)',marginTop:70}}>{pillars.map(([ey,title,body])=><div key={title} style={{background:'#F0EEE8',padding:34,minHeight:220}}><div style={{fontFamily:'DM Mono',fontSize:9,color:gold,letterSpacing:'.18em',marginBottom:22}}>{ey}</div><h3 style={{fontSize:24,fontWeight:500,margin:'0 0 12px'}}>{title}</h3><p style={{fontSize:13,lineHeight:1.8,color:muted,margin:0}}>{body}</p></div>)}</div>
          </div>
        </section>

        <section id="marketplace" className="section" style={{padding:'100px clamp(22px,7vw,100px)',background:navy,color:cream}}>
          <div style={{maxWidth:1240,margin:'0 auto'}}><div style={{fontFamily:'DM Mono',fontSize:10,color:gold,letterSpacing:'.18em',marginBottom:18}}>ONE IDENTITY. MULTIPLE OPPORTUNITIES.</div><h2 style={{fontSize:'clamp(40px,6vw,74px)',fontWeight:300,letterSpacing:'-.045em',maxWidth:850,margin:'0 0 20px'}}>Be assessed once.<br/><span style={{color:gold}}>Be discovered differently.</span></h2><p style={{color:'rgba(247,244,238,.55)',fontSize:16,lineHeight:1.8,maxWidth:680}}>Your Valoria professional identity can support the way buyers discover you — as a candidate, speaker or facilitator.</p>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:1,background:'rgba(247,244,238,.10)',marginTop:55}} className="proof-grid">{[['ATB CONNECT','Candidates','For employers and recruiters looking for assessed professional capability.'],['ATB SPOTLIGHT','Speakers','For organisations looking for speakers with clearer professional positioning.'],['FACILITATORS','Facilitators','For organisations seeking professionals who can lead learning and development.']].map(([ey,t,b])=><div key={t} style={{background:navy,padding:32,minHeight:240}}><div style={{fontFamily:'DM Mono',fontSize:9,color:gold,letterSpacing:'.15em'}}>{ey}</div><h3 style={{fontSize:27,fontWeight:400,margin:'28px 0 12px'}}>{t}</h3><p style={{fontSize:13,lineHeight:1.8,color:'rgba(247,244,238,.48)'}}>{b}</p><a href="#" style={{display:'inline-block',marginTop:14,color:gold,fontSize:11,fontWeight:700,letterSpacing:'.08em'}}>EXPLORE →</a></div>)}</div></div>
        </section>

        <section id="events" className="section" style={{padding:'100px clamp(22px,7vw,100px)',background:'#fff'}}><div style={{maxWidth:1240,margin:'0 auto'}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'end',gap:30,marginBottom:42,flexWrap:'wrap'}}><div><div style={{fontFamily:'DM Mono',fontSize:10,color:gold,letterSpacing:'.18em',marginBottom:18}}>COMING SOON</div><h2 style={{fontSize:'clamp(38px,5vw,58px)',fontWeight:400,margin:0,letterSpacing:'-.035em'}}>The Professional Standard Series</h2></div><a className="hp-link" href="#" style={{fontSize:11,fontWeight:700,letterSpacing:'.08em',color:ink}}>VIEW ALL EVENTS →</a></div><div style={{border:'1px solid rgba(15,15,26,.10)',display:'grid',gridTemplateColumns:'1fr 1.35fr'}} className="hero-grid"><div style={{minHeight:330,background:'#E8E2D4',display:'flex',alignItems:'center',justifyContent:'center'}}><div style={{fontFamily:'DM Mono',fontSize:10,color:'#7E714D',letterSpacing:'.16em'}}>EVENT IMAGE</div></div><div style={{padding:'42px 46px'}}><div style={{fontFamily:'DM Mono',fontSize:9,color:gold,letterSpacing:'.16em'}}>SATURDAY · 10:00 AM</div><h3 style={{fontSize:34,fontWeight:500,lineHeight:1.15,margin:'22px 0 16px'}}>Why Being Good at Your Job Is No Longer Enough</h3><p style={{color:muted,lineHeight:1.8,fontSize:14,maxWidth:560}}>A conversation about professional visibility, evidence of capability and what the modern market now expects from people who want to be trusted with bigger opportunities.</p><button style={{marginTop:20,background:navy,color:cream,border:0,padding:'14px 20px',fontSize:11,fontWeight:700,letterSpacing:'.08em'}}>REGISTER FOR THE EVENT →</button></div></div></div></section>

        <section id="about" className="section" style={{padding:'86px clamp(22px,7vw,100px)',background:gold,color:navy}}><div style={{maxWidth:1000,margin:'0 auto',textAlign:'center'}}><div style={{fontFamily:'DM Mono',fontSize:10,letterSpacing:'.18em',marginBottom:20}}>THE PROMISE</div><h2 style={{fontSize:'clamp(36px,5vw,60px)',fontWeight:400,letterSpacing:'-.04em',margin:'0 0 18px'}}>Worth should be more than a claim.</h2><p style={{fontSize:17,lineHeight:1.9,maxWidth:720,margin:'0 auto 30px'}}>It should be understandable, developable and discoverable. That is the infrastructure Valoria is building.</p><button onClick={()=>go('start')} style={{background:navy,color:cream,border:0,padding:'16px 24px',fontSize:11,fontWeight:700,letterSpacing:'.1em',cursor:'pointer'}}>START WITH VALU →</button></div></section>
      </main>

      <footer style={{background:'#090910',color:cream,padding:'55px clamp(22px,7vw,100px) 30px'}}><div className="footer-grid" style={{maxWidth:1240,margin:'0 auto',display:'grid',gridTemplateColumns:'2fr 1fr 1fr',gap:50}}><div><div style={{fontWeight:700,letterSpacing:'.12em',fontSize:14}}>VALORIA <span style={{fontWeight:400,color:gold}}>INSTITUTE</span></div><p style={{fontSize:12,lineHeight:1.8,color:'rgba(247,244,238,.38)',maxWidth:330}}>Professional infrastructure for assessment, development and opportunity.</p></div><div><div style={{fontFamily:'DM Mono',fontSize:9,color:gold,letterSpacing:'.16em',marginBottom:15}}>PLATFORM</div><div style={{fontSize:12,lineHeight:2.1,color:'rgba(247,244,238,.45)'}}>VALU Index<br/>PRIME Framework<br/>Marketplace<br/>Valoria Develop</div></div><div><div style={{fontFamily:'DM Mono',fontSize:9,color:gold,letterSpacing:'.16em',marginBottom:15}}>GET STARTED</div><div style={{fontSize:12,lineHeight:2.1,color:'rgba(247,244,238,.45)'}}>Take VALU<br/>Explore the Bureau<br/>For Organisations<br/>Contact</div></div></div><div style={{maxWidth:1240,margin:'45px auto 0',paddingTop:20,borderTop:'1px solid rgba(247,244,238,.07)',fontFamily:'DM Mono',fontSize:8,color:'rgba(247,244,238,.22)',letterSpacing:'.08em'}}>© 2026 VALORIA INSTITUTE · WORTH. BUILT.</div></footer>
    </div>
  );
}
