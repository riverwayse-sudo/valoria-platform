// run-report.js
//
// Usage:
//   node run-report.js fp_jj5aff
//   node run-report.js fp_jj5aff --force     (regenerate/resend even if already done)
//
// Requires Node 18+ (built-in fetch). Run with:  node run-report.js <identity_hash>

const BASE_URL = "https://valoria-final.vercel.app";

const identityHash = process.argv[2];
const force = process.argv.includes("--force");

if (!identityHash) {
  console.error("Usage: node run-report.js <identity_hash> [--force]");
  process.exit(1);
}

function buildPrompt({ name, role, total_score, cluster_scores, skill_scores, designation }) {
  const skillLines = Object.entries(skill_scores || {})
    .filter(([s]) => s !== "Validity")
    .sort(([, a], [, b]) => b - a)
    .map(([s, sc]) => `  - ${s}: ${sc}/100`)
    .join("\n");

  return `You are writing a personalised professional development report for ${name}, a ${role} who completed the VALU Index assessment.
WRITING RULES:
1. Write like a trusted senior colleague who tells the truth.
2. Plain, direct language. No jargon: never use journey, leverage (as verb), holistic, impactful, synergy, empower, transformative, game-changer, paradigm, unlock, actionable.
3. Be specific and name real skills and consequences.
4. Speak directly to them as "you."
SCORE DATA:
VALU Index: ${total_score}/100 — ${designation}
SKILL SCORES:
${skillLines}
WRITE IN THESE SECTIONS:
## YOUR SCORE: ${total_score}/100 — ${String(designation).toUpperCase()}
## WHAT YOU ARE GOOD AT
## WHERE YOU ARE LOSING GROUND
## WHAT THIS COSTS YOU IN THE NEXT 12 MONTHS
## YOUR ONE ACTION FOR THIS WEEK
## THE QUESTION TO SIT WITH
Start directly with ## YOUR SCORE, no introduction.`;
}

async function getAssessmentData(identity_hash) {
  const res = await fetch(`${BASE_URL}/api/get-assessment-data`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identity_hash }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`get-assessment-data failed: ${JSON.stringify(data)}`);
  return data.row;
}

// report.js streams SSE. We read the stream and concatenate the text deltas.
async function generateReport(prompt, identity_hash) {
  const res = await fetch(`${BASE_URL}/api/report`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, identity_hash }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`report generation failed (${res.status}): ${err}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop(); // keep incomplete last line for next chunk

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const jsonStr = line.slice(6).trim();
      if (!jsonStr || jsonStr === "[DONE]") continue;
      try {
        const event = JSON.parse(jsonStr);
        if (event.type === "content_block_delta" && event.delta?.text) {
          fullText += event.delta.text;
          process.stdout.write("."); // progress dots while generating
        }
      } catch {
        // ignore lines that aren't valid JSON (e.g. event: type lines)
      }
    }
  }
  process.stdout.write("\n");
  return fullText;
}

async function saveReport(identity_hash, { report_text, mark_sent } = {}) {
  const res = await fetch(`${BASE_URL}/api/save-report`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identity_hash, report_text, mark_sent }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`save-report failed: ${JSON.stringify(data)}`);
  return data;
}

async function sendEmail(email, identity_hash, reportText) {
  const res = await fetch(`${BASE_URL}/api/send-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, identity_hash, reportText }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`send-email failed: ${JSON.stringify(data)}`);
  return data;
}

async function main() {
  console.log(`\n=== ${identityHash} ===`);

  console.log("1/4  Looking up assessment data...");
  const row = await getAssessmentData(identityHash);

  if (!row.email) {
    console.log("No email on file for this row — skipping.");
    return;
  }

  if (row.report_email_sent_at && !force) {
    console.log(`Already sent on ${row.report_email_sent_at}. Re-run with --force to resend.`);
    return;
  }

  let reportText = row.ai_report;

  if (reportText && !force) {
    console.log("2/4  Report already exists — reusing saved version (skipping generation).");
  } else {
    console.log("2/4  Generating report with Claude (this takes ~15-25s)...");
    const prompt = buildPrompt(row);
    reportText = await generateReport(prompt, identityHash);
    console.log(`     Generated ${reportText.length} characters.`);

    console.log("3/4  Saving report to database...");
    await saveReport(identityHash, { report_text: reportText });
  }

  console.log("4/4  Sending email...");
  await sendEmail(row.email, identityHash, reportText);
  await saveReport(identityHash, { mark_sent: true });

  console.log(`Done — report sent to ${row.email}.\n`);
}

main().catch((err) => {
  console.error("\nFAILED:", err.message);
  process.exit(1);
});