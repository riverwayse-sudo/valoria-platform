#!/usr/bin/env node
// valoria-final/scripts/verify-environment-scope.mjs
//
// CLI wrapper around lib/environment-scope.js. Reports whether a deployment's
// environment is internally consistent, WITHOUT printing any secret value.
//
// This is a read-only inspection: it makes no network calls and writes nothing.
// It reads environment variables (or a dotenv file) and reasons about them.
//
// Usage:
//   node scripts/verify-environment-scope.mjs                    # process env
//   node scripts/verify-environment-scope.mjs --env-file=.env.staging
//   node scripts/verify-environment-scope.mjs --json
//
// Exit code 0 when every check passes, 1 when any check fails.

import fs from "node:fs";
import { evaluateScope, parseEnvFile, render } from "../lib/environment-scope.js";

function main(argv) {
  const envFileArg = argv.find((a) => a.startsWith("--env-file="));
  const asJson = argv.includes("--json");

  let env = process.env;
  let source = "process environment";
  if (envFileArg) {
    const file = envFileArg.slice("--env-file=".length);
    if (!fs.existsSync(file)) {
      console.error(`env file not found: ${file}`);
      return 1;
    }
    env = parseEnvFile(fs.readFileSync(file, "utf8"));
    source = file;
  }

  const vercelEnv = env.VERCEL_ENV || "";
  const scope = vercelEnv === "production" ? "production" : "preview";
  const evaluation = evaluateScope(scope, env);

  if (asJson) {
    console.log(JSON.stringify({ source, ...evaluation }, null, 2));
  } else {
    console.log(`Environment scope check (source: ${source})`);
    console.log(`VERCEL_ENV=${vercelEnv || "(unset)"} -> evaluating as "${scope}"`);
    console.log("");
    console.log(render(evaluation));
  }
  return evaluation.failed === 0 ? 0 : 1;
}

// Run only when invoked directly, so the pure functions stay importable.
const invoked = process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop());
if (invoked) {
  process.exit(main(process.argv.slice(2)));
}
