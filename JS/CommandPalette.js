"use client";

/**
 * CommandPalette
 * ---------------
 * Global ⌘K / Ctrl+K launcher. Mount once, globally, the same way
 * LivingCurrent and WhatsAppFloat are already mounted in app/layout.js:
 *
 *   import CommandPalette from "@/components/CommandPalette";
 *   ...
 *   <WhatsAppFloat />
 *   <PageTransition />
 *   <CommandPalette />
 *
 * Design intent: this is the one place the site gets to behave like
 * the "operating system" it talks about, instead of just naming the
 * metaphor. Kept deliberately quiet — no entrance animation beyond a
 * fade, no sound, no gimmick — because the premium signal here is
 * that it exists and works instantly, not that it performs for you.
 *
 * Data: self-contained by default so this drops in without requiring
 * changes elsewhere. Course entries are pulled from the real
 * app/courses/data.js module if you pass it in via the `courses` prop
 * (recommended); otherwise a fallback list is used so the component
 * never breaks if that import path changes.
 *
 * To enable deep-linking into a specific DEOS dimension (e.g. jumping
 * straight to D7 on the /deos page), add `id={d.n}` to each row in
 * DeosConsole's .console-row (or the equivalent <li> in the static
 * list) — the palette already links to /deos#D7 etc., it just needs
 * a matching anchor to land on.
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const NAV_COMMANDS = [
  { group: "Navigate", label: "Home", href: "/" },
  { group: "Navigate", label: "DEOS Framework", href: "/deos" },
  { group: "Navigate", label: "Services & Pricing Tiers", href: "/services" },
  { group: "Navigate", label: "Courses", href: "/courses" },
  { group: "Navigate", label: "About Femi", href: "/about" },
  { group: "Navigate", label: "Start a DEOS Audit", href: "/audit" },
  { group: "Navigate", label: "Contact", href: "/contact" },
];

const DEOS_COMMANDS = [
  { group: "DEOS Dimensions", label: "D1 — Intent Signal Precision", href: "/deos#D1" },
  { group: "DEOS Dimensions", label: "D2 — Frictionless Conversion Architecture", href: "/deos#D2" },
  { group: "DEOS Dimensions", label: "D3 — System 1 Activation", href: "/deos#D3" },
  { group: "DEOS Dimensions", label: "D4 — Mental Availability Engineering", href: "/deos#D4" },
  { group: "DEOS Dimensions", label: "D5 — 95% Content Architecture", href: "/deos#D5" },
  { group: "DEOS Dimensions", label: "D6 — Shareability & Social Signal", href: "/deos#D6" },
  { group: "DEOS Dimensions", label: "D7 — Category Design Clarity", href: "/deos#D7" },
  { group: "DEOS Dimensions", label: "D8 — Trust & Credibility Architecture", href: "/deos#D8" },
  { group: "DEOS Dimensions", label: "D9 — Temporal Orientation Balance", href: "/deos#D9" },
];

const FALLBACK_COURSES = [
  { group: "Courses", label: "Introduction to Digital Marketing", href: "/courses/intro-to-digital-marketing" },
  { group: "Courses", label: "Paid Ads", href: "/courses/paid-ads" },
  { group: "Courses", label: "Email Marketing", href: "/courses/email-marketing" },
  { group: "Courses", label: "Web Design", href: "/courses/web-design" },
  { group: "Courses", label: "Copywriting", href: "/courses/copywriting" },
];

const QUICK_ACTIONS = [
  { group: "Actions", label: "Email hello@riverwayse.com", href: "mailto:hello@riverwayse.com" },
  { group: "Actions", label: "Book a growth audit", href: "/contact" },
];

export default function CommandPalette({ courses }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef(null);
  const router = useRouter();

  const courseCommands =
    (courses || []).length > 0
      ? courses.map((c) => ({ group: "Courses", label: c.name, href: `/courses/${c.slug}` }))
      : FALLBACK_COURSES;

  const ALL_COMMANDS = [...NAV_COMMANDS, ...DEOS_COMMANDS, ...courseCommands, ...QUICK_ACTIONS];

  const results = query.trim()
    ? ALL_COMMANDS.filter((c) => c.label.toLowerCase().includes(query.trim().toLowerCase()))
    : ALL_COMMANDS;

  // group results in display order, preserving first-seen group order
  const groups = [];
  results.forEach((r) => {
    let g = groups.find((g) => g.name === r.group);
    if (!g) {
      g = { name: r.group, items: [] };
      groups.push(g);
    }
    g.items.push(r);
  });

  const flatResults = groups.flatMap((g) => g.items);

  useEffect(() => {
    function onKeyDown(e) {
      const isMac = navigator.platform.toUpperCase().includes("MAC");
      const modifierPressed = isMac ? e.metaKey : e.ctrlKey;

      if (modifierPressed && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIdx(0);
      // slight delay so the panel is mounted before focus is requested
      requestAnimationFrame(() => inputRef.current?.focus());
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
  }, [open]);

  function go(href) {
    setOpen(false);
    if (href.startsWith("mailto:")) {
      window.location.href = href;
    } else {
      router.push(href);
    }
  }

  function onInputKeyDown(e) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, flatResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = flatResults[activeIdx];
      if (target) go(target.href);
    }
  }

  return (
    <>
      {/* Quiet trigger hint — optional, shown in corner when closed.
          Safe to delete this block if Nav already surfaces a ⌘K hint. */}
      {!open && (
        <button
          className="cmdk-hint"
          onClick={() => setOpen(true)}
          aria-label="Open command palette"
        >
          <span>⌘K</span>
        </button>
      )}

      {open && (
        <div className="cmdk-overlay" onClick={() => setOpen(false)}>
          <div
            className="cmdk-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cmdk-input-row">
              <span className="cmdk-prompt" aria-hidden="true">
                ›
              </span>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActiveIdx(0);
                }}
                onKeyDown={onInputKeyDown}
                placeholder="Jump to a dimension, course, or page…"
                aria-label="Search"
                autoComplete="off"
                spellCheck="false"
              />
              <kbd className="cmdk-esc">esc</kbd>
            </div>

            <div className="cmdk-results">
              {groups.length === 0 && <p className="cmdk-empty">No matches. Try “D7”, “paid ads”, or “contact”.</p>}

              {groups.map((g) => (
                <div key={g.name} className="cmdk-group">
                  <p className="cmdk-group-label">{g.name}</p>
                  {g.items.map((item) => {
                    const flatIdx = flatResults.indexOf(item);
                    return (
                      <button
                        key={item.href + item.label}
                        className={`cmdk-item ${flatIdx === activeIdx ? "is-active" : ""}`}
                        onMouseEnter={() => setActiveIdx(flatIdx)}
                        onClick={() => go(item.href)}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .cmdk-hint {
          position: fixed;
          bottom: 24px;
          right: 24px;
          z-index: 60;
          background: rgba(28, 51, 80, 0.7);
          backdrop-filter: blur(10px);
          border: 1px solid var(--navy-700);
          border-radius: 100px;
          padding: 9px 14px;
          font-family: var(--font-display);
          font-size: 12px;
          letter-spacing: 0.06em;
          color: var(--ink-300);
          transition: border-color 0.25s ease, color 0.25s ease;
        }

        .cmdk-hint:hover {
          border-color: var(--gold);
          color: var(--ink-100);
        }

        .cmdk-overlay {
          position: fixed;
          inset: 0;
          z-index: 100;
          background: rgba(11, 24, 38, 0.72);
          backdrop-filter: blur(4px);
          display: flex;
          justify-content: center;
          align-items: flex-start;
          padding-top: min(14vh, 140px);
          animation: cmdk-fade 0.18s ease;
        }

        @keyframes cmdk-fade {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        .cmdk-panel {
          width: min(560px, 92vw);
          max-height: 64vh;
          display: flex;
          flex-direction: column;
          background: rgba(22, 41, 62, 0.92);
          border: 1px solid var(--accent-wash);
          border-radius: 16px;
          box-shadow: 0 30px 80px -20px rgba(0, 0, 0, 0.6);
          overflow: hidden;
        }

        .cmdk-input-row {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 16px 18px;
          border-bottom: 1px solid var(--navy-700);
        }

        .cmdk-prompt {
          color: var(--gold);
          font-family: var(--font-display);
          font-size: 16px;
        }

        .cmdk-input-row input {
          flex: 1;
          background: none;
          border: none;
          outline: none;
          color: var(--ink-100);
          font-family: var(--font-body);
          font-size: 15px;
        }

        .cmdk-input-row input::placeholder {
          color: var(--ink-500);
        }

        .cmdk-esc {
          font-family: var(--font-display);
          font-size: 10px;
          color: var(--ink-500);
          border: 1px solid var(--navy-700);
          border-radius: 5px;
          padding: 2px 6px;
        }

        .cmdk-results {
          overflow-y: auto;
          padding: 10px;
        }

        .cmdk-empty {
          padding: 20px 10px;
          font-size: 14px;
          color: var(--ink-500);
        }

        .cmdk-group {
          margin-bottom: 6px;
        }

        .cmdk-group-label {
          font-family: var(--font-display);
          font-size: 10.5px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--ink-500);
          padding: 8px 10px 4px;
        }

        .cmdk-item {
          display: block;
          width: 100%;
          text-align: left;
          padding: 10px 12px;
          border-radius: 8px;
          background: none;
          border: none;
          color: var(--ink-300);
          font-family: var(--font-body);
          font-size: 14.5px;
          transition: background 0.12s ease, color 0.12s ease;
        }

        .cmdk-item.is-active {
          background: var(--accent-wash);
          color: var(--ink-100);
        }

        @media (max-width: 640px) {
          .cmdk-hint {
            bottom: 16px;
            right: 16px;
          }
        }
      `}</style>
    </>
  );
}
