"use client";

/**
 * DeosConsole
 * ------------
 * Replaces the static <ol className="dim-list"> section on /deos with a
 * sticky, scroll-synced "operating system" readout — the interface
 * embodying the DEOS thesis (an operating system, not a checklist).
 *
 * Desktop: left column pins (horizon indicator + running score dial)
 * while the nine dimension rows scroll past on the right. An
 * IntersectionObserver tracks which row is centered and drives the
 * horizon label, the score tally, and the hard-stop pulse.
 *
 * Mobile: the sticky column collapses above the list and becomes a
 * slim progress rail — no pinning, since there's no spare viewport
 * width for a true two-column layout. Falls back gracefully to
 * sequential reading, same as the rest of the site's Reveal pattern.
 *
 * Drop-in usage on app/deos/page.js — replace the existing
 * <section className="section deos-list">...</section> block with:
 *
 *   import DeosConsole from "@/components/DeosConsole";
 *   ...
 *   <DeosConsole dimensions={DIMENSIONS} horizons={HORIZONS} />
 *
 * DIMENSIONS and HORIZONS are the same arrays already defined at the
 * top of app/deos/page.js — no data reshaping needed.
 */

import { useEffect, useRef, useState } from "react";

// Weight per dimension toward the running score dial. Hard-stop
// dimensions count for more — a visual echo of the real DEOS rule
// that D1/D7/D8 can override the aggregate score.
function scoreWeight(dim) {
  return dim.hardStop ? 14 : 9;
}

export default function DeosConsole({ dimensions, horizons }) {
  const rowRefs = useRef([]);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return; // static state, no scroll-tracking needed

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = Number(entry.target.dataset.idx);
            setActiveIndex(idx);
          }
        });
      },
      {
        // A thin horizontal band at the vertical center of the viewport —
        // a row is "active" when it crosses that band, not merely visible.
        rootMargin: "-42% 0px -42% 0px",
        threshold: 0,
      }
    );

    rowRefs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const maxScore = dimensions.reduce((sum, d) => sum + scoreWeight(d), 0);
  const runningScore = dimensions
    .slice(0, activeIndex + 1)
    .reduce((sum, d) => sum + scoreWeight(d), 0);
  const scorePct = Math.round((runningScore / maxScore) * 100);

  const activeDim = dimensions[activeIndex];
  const activeHorizon = horizons.find((h) => h.id === activeDim?.horizon);

  return (
    <section className="deos-console" aria-label="The nine DEOS dimensions">
      <div className="container console-grid">
        <div className="console-rail">
          <div className="console-rail-inner">
            <p className="eyebrow">Reading dimension</p>
            <div className="console-dial" role="img" aria-label={`Score ${scorePct} of 100`}>
              <svg viewBox="0 0 120 120" className="console-dial-svg">
                <circle cx="60" cy="60" r="52" className="dial-track" />
                <circle
                  cx="60"
                  cy="60"
                  r="52"
                  className="dial-progress"
                  style={{
                    strokeDasharray: `${2 * Math.PI * 52}`,
                    strokeDashoffset: `${2 * Math.PI * 52 * (1 - scorePct / 100)}`,
                  }}
                />
              </svg>
              <span className="console-dial-num">{scorePct}</span>
            </div>

            <div className="console-horizon">
              <span className="console-horizon-id">{activeHorizon?.id}</span>
              <span className="console-horizon-name">{activeHorizon?.name}</span>
              <span className="console-horizon-time">{activeHorizon?.timeframe}</span>
            </div>

            <div className="console-current">
              <span className="console-current-n">{activeDim?.n}</span>
              <h3 className="console-current-name">
                {activeDim?.name}
                {activeDim?.hardStop && <span className="console-hardstop">Hard stop</span>}
              </h3>
            </div>
          </div>
        </div>

        <ol className="console-list">
          {dimensions.map((d, i) => (
            <li
              key={d.n}
              ref={(el) => (rowRefs.current[i] = el)}
              data-idx={i}
              className={`console-row ${i === activeIndex ? "is-active" : ""} ${
                d.hardStop ? "is-hardstop" : ""
              }`}
            >
              <span className="console-row-n">{d.n}</span>
              <div className="console-row-body">
                <p className="console-row-horizon">{d.horizon}</p>
                <h4>
                  {d.name}
                  {d.sub && <span className="console-row-sub"> {d.sub}</span>}
                </h4>
                <p className="console-row-desc">{d.desc}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <style jsx>{`
        .deos-console {
          padding: clamp(48px, 8vw, 96px) 0;
        }

        .console-grid {
          display: grid;
          grid-template-columns: 300px 1fr;
          gap: 64px;
          align-items: start;
        }

        /* ---- sticky left rail ---- */
        .console-rail {
          position: sticky;
          top: 100px;
        }

        .console-rail-inner {
          background: rgba(28, 51, 80, 0.55);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          border: 1px solid var(--accent-wash);
          border-radius: 18px;
          padding: 28px 24px;
        }

        .console-dial {
          position: relative;
          width: 120px;
          height: 120px;
          margin: 18px auto 22px;
        }

        .console-dial-svg {
          width: 100%;
          height: 100%;
          transform: rotate(-90deg);
        }

        .dial-track {
          fill: none;
          stroke: var(--navy-700);
          stroke-width: 6;
        }

        .dial-progress {
          fill: none;
          stroke: url(#none);
          stroke: var(--gold);
          stroke-width: 6;
          stroke-linecap: round;
          transition: stroke-dashoffset 0.5s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .console-dial-num {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: var(--font-display);
          font-size: 26px;
          font-weight: 600;
          color: var(--ink-100);
        }

        .console-horizon {
          display: flex;
          flex-direction: column;
          gap: 4px;
          text-align: center;
          padding-bottom: 18px;
          border-bottom: 1px solid var(--navy-700);
          margin-bottom: 18px;
        }

        .console-horizon-id {
          font-family: var(--font-display);
          font-size: 11px;
          letter-spacing: 0.14em;
          color: var(--gold);
        }

        .console-horizon-name {
          font-family: var(--font-serif);
          font-size: 20px;
          font-weight: 300;
          color: var(--ink-100);
        }

        .console-horizon-time {
          font-family: var(--font-display);
          font-size: 11px;
          color: var(--ink-500);
        }

        .console-current {
          text-align: center;
        }

        .console-current-n {
          font-family: var(--font-display);
          font-size: 11px;
          letter-spacing: 0.14em;
          color: var(--ink-500);
        }

        .console-current-name {
          margin-top: 4px;
          font-size: 17px;
        }

        .console-hardstop {
          display: inline-block;
          margin-left: 8px;
          font-family: var(--font-display);
          font-size: 10px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--ember);
          border: 1px solid rgba(232, 98, 42, 0.4);
          border-radius: 100px;
          padding: 2px 8px;
          vertical-align: middle;
          animation: hardstop-pulse 2.4s ease-in-out infinite;
        }

        @keyframes hardstop-pulse {
          0%,
          100% {
            box-shadow: 0 0 0 0 rgba(232, 98, 42, 0.35);
          }
          50% {
            box-shadow: 0 0 0 6px rgba(232, 98, 42, 0);
          }
        }

        /* ---- scrolling row list ---- */
        .console-list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .console-row {
          display: grid;
          grid-template-columns: 56px 1fr;
          gap: 20px;
          padding: 26px 28px;
          border-radius: 16px;
          border: 1px solid transparent;
          background: rgba(28, 51, 80, 0.28);
          transition: background 0.35s ease, border-color 0.35s ease, transform 0.35s ease;
          scroll-margin-top: 120px;
        }

        .console-row.is-active {
          background: rgba(28, 51, 80, 0.65);
          border-color: var(--accent-wash);
          transform: translateX(4px);
        }

        .console-row.is-hardstop.is-active {
          border-color: rgba(232, 98, 42, 0.4);
        }

        .console-row-n {
          font-family: var(--font-display);
          font-size: 13px;
          font-weight: 600;
          color: var(--ink-500);
          transition: color 0.35s ease;
        }

        .console-row.is-active .console-row-n {
          color: var(--gold);
        }

        .console-row-horizon {
          font-family: var(--font-display);
          font-size: 11px;
          letter-spacing: 0.1em;
          color: var(--ink-500);
          margin-bottom: 6px;
        }

        .console-row-body h4 {
          font-family: var(--font-serif);
          font-weight: 300;
          font-size: 22px;
          color: var(--ink-100);
        }

        .console-row-sub {
          font-family: var(--font-body);
          font-size: 14px;
          color: var(--ink-500);
        }

        .console-row-desc {
          margin-top: 8px;
          font-size: 15px;
          line-height: 1.6;
          color: var(--ink-300);
          max-width: 56ch;
        }

        /* ---- mobile: no pinning, slim horizontal progress instead ---- */
        @media (max-width: 900px) {
          .console-grid {
            grid-template-columns: 1fr;
            gap: 28px;
          }

          .console-rail {
            position: static;
          }

          .console-rail-inner {
            display: flex;
            align-items: center;
            gap: 18px;
            padding: 16px 18px;
          }

          .console-dial {
            width: 56px;
            height: 56px;
            margin: 0;
            flex-shrink: 0;
          }

          .console-dial-num {
            font-size: 15px;
          }

          .console-horizon {
            flex-direction: row;
            gap: 10px;
            align-items: baseline;
            text-align: left;
            border-bottom: none;
            margin-bottom: 0;
            padding-bottom: 0;
          }

          .console-current {
            display: none;
          }

          .console-row {
            padding: 20px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .console-hardstop {
            animation: none;
          }
          .console-row {
            transition: none;
          }
        }
      `}</style>
    </section>
  );
}
