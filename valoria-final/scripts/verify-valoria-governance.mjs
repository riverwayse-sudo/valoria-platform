import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const candidates = [
  resolve(process.cwd(), "docs/engineering"),
  resolve(process.cwd(), "../docs/engineering"),
];
const docsDir = candidates.find((dir) => existsSync(resolve(dir, "VALORIA_UNIFIED_GOVERNANCE.md")));
if (!docsDir) {
  console.error("Governance check failed: shared Valoria governance documents were not found.");
  process.exit(1);
}

const governance = readFileSync(resolve(docsDir, "VALORIA_UNIFIED_GOVERNANCE.md"), "utf8");
const register = readFileSync(resolve(docsDir, "VALORIA_REQUIREMENTS_REGISTER.md"), "utf8");
const required = [
  "VALORIA_GOVERNANCE_VERSION: 1.0.0",
  "The 9-question Taster and the separate 58-question full assessment are distinct",
  "54 scored questions plus 4 validity anchors",
  "Historical 15-question sessions remain supported",
  "VALU is presented in points",
  "Public visibility requires the current, explicit participant-entered acknowledgement",
  "One account has one canonical professional profile",
  "authenticated human review",
  "Cloudflare is the approved production deployment target",
  "Known Critical or High defects block production release",
];
const missing = required.filter((item) => !governance.toLowerCase().includes(item.toLowerCase()));
if (missing.length) {
  console.error("Governance check failed. Missing protected clauses:", missing);
  process.exit(1);
}
if (!register.includes("VALORIA_GOVERNANCE_VERSION: 1.0.0")) {
  console.error("Governance check failed: requirements register version does not match.");
  process.exit(1);
}
for (const section of ["Protected standards", "Strategic Review requirements", "Content Overhaul requirements", "Cross-repository architecture", "Decision log"]) {
  if (!register.includes(section)) {
    console.error(`Governance check failed: requirements register is missing "${section}".`);
    process.exit(1);
  }
}
console.log("Valoria governance contract integrity: PASS (documentation guard only; application behavior is covered by the existing test suites).");
