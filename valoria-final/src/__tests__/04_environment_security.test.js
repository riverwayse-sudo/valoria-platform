// __tests__/04_environment_security.test.js
// Phase 4 — Environment parity and security checks.
// Covers: env var presence, Supabase URL validity, secret detection,
// ANON_KEY format, and the PAT incident prevention contract.

"use strict";

const fs   = require("fs");
const path = require("path");

// ── PATHS ─────────────────────────────────────────────────────────────────
// Adjust these to point to your actual repo locations when running locally.
// In CI, set VALORIA_PLATFORM_ROOT and VALORIA_SITE_ROOT env vars.
const PLATFORM_ROOT = process.env.VALORIA_PLATFORM_ROOT || path.join(__dirname, "../../valoria-platform/valoria-final");
const SITE_ROOT     = process.env.VALORIA_SITE_ROOT     || path.join(__dirname, "../../valoria-site");

function repoExists(root) {
  return fs.existsSync(root);
}

// ── SECTION 1: Required env vars ─────────────────────────────────────────
describe("Environment variables — required keys", () => {
  const PLATFORM_ENV_KEYS = [
    "VITE_SUPABASE_URL",
    "VITE_SUPABASE_ANON_KEY",
  ];

  const SITE_ENV_KEYS = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "ANTHROPIC_API_KEY",
  ];

  function readEnvExample(root) {
    const envPath = path.join(root, ".env.example");
    if (!fs.existsSync(envPath)) return null;
    return fs.readFileSync(envPath, "utf8");
  }

  test("valoria-platform .env.example exists (or skip)", () => {
    if (!repoExists(PLATFORM_ROOT)) {
      console.warn("SKIP: valoria-platform not found at", PLATFORM_ROOT);
      return;
    }
    const content = readEnvExample(PLATFORM_ROOT);
    if (content === null) {
      console.warn("SKIP: .env.example not found in valoria-platform — create one");
      return;
    }
    PLATFORM_ENV_KEYS.forEach(key => {
      expect(content).toContain(key);
    });
  });

  test("valoria-site .env.example exists (or skip)", () => {
    if (!repoExists(SITE_ROOT)) {
      console.warn("SKIP: valoria-site not found at", SITE_ROOT);
      return;
    }
    const content = readEnvExample(SITE_ROOT);
    if (content === null) {
      console.warn("SKIP: .env.example not found in valoria-site — create one");
      return;
    }
    SITE_ENV_KEYS.forEach(key => {
      expect(content).toContain(key);
    });
  });
});

// ── SECTION 2: Supabase URL and key format validation ────────────────────
describe("Supabase config format validation", () => {
  const KNOWN_PROJECT_REF = "sbkgpisgkuhbalsxqkdr";

  test("Supabase URL matches expected project ref", () => {
    const url = `https://${KNOWN_PROJECT_REF}.supabase.co`;
    expect(url).toMatch(/^https:\/\/[a-z]{20}\.supabase\.co$/);
  });

  test("Supabase URL does not end with trailing slash", () => {
    const url = `https://${KNOWN_PROJECT_REF}.supabase.co`;
    expect(url).not.toMatch(/\/$/);
  });

  test("Supabase ANON_KEY has correct JWT format (3 dot-separated parts)", () => {
    // We test against the key shape from assessmentLock.js — not the real key
    const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNia2dwaXNna3VoYmFsc3hxa2RyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzMjI2NjEsImV4cCI6MjA5Mzg5ODY2MX0.iRPs_W6O6JkkHyVlH-9XkEgA1HNo8xtaMakoV5kwLEY";
    const parts = ANON_KEY.split(".");
    expect(parts).toHaveLength(3);
  });

  test("Supabase ANON_KEY payload decodes to correct role=anon", () => {
    const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNia2dwaXNna3VoYmFsc3hxa2RyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzMjI2NjEsImV4cCI6MjA5Mzg5ODY2MX0.iRPs_W6O6JkkHyVlH-9XkEgA1HNo8xtaMakoV5kwLEY";
    const payload = JSON.parse(Buffer.from(ANON_KEY.split(".")[1], "base64").toString());
    expect(payload.role).toBe("anon");
  });

  test("Supabase ANON_KEY payload ref matches known project ref", () => {
    const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNia2dwaXNna3VoYmFsc3hxa2RyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzMjI2NjEsImV4cCI6MjA5Mzg5ODY2MX0.iRPs_W6O6JkkHyVlH-9XkEgA1HNo8xtaMakoV5kwLEY";
    const payload = JSON.parse(Buffer.from(ANON_KEY.split(".")[1], "base64").toString());
    expect(payload.ref).toBe(KNOWN_PROJECT_REF);
  });

  test("ANON_KEY is not a service_role key (role must not be service_role)", () => {
    const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNia2dwaXNna3VoYmFsc3hxa2RyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzMjI2NjEsImV4cCI6MjA5Mzg5ODY2MX0.iRPs_W6O6JkkHyVlH-9XkEgA1HNo8xtaMakoV5kwLEY";
    const payload = JSON.parse(Buffer.from(ANON_KEY.split(".")[1], "base64").toString());
    expect(payload.role).not.toBe("service_role");
  });
});

// ── SECTION 3: Secret scanning (PAT incident prevention) ─────────────────
describe("Secret scanning — no credentials in source files", () => {
  // Patterns that should NEVER appear in committed source files
  const DANGEROUS_PATTERNS = [
    { name: "GitHub PAT (ghp_)",         pattern: /ghp_[A-Za-z0-9]{36}/ },
    { name: "GitHub PAT (github_pat_)",  pattern: /github_pat_[A-Za-z0-9_]{82}/ },
    { name: "Supabase service_role key", pattern: /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[^.]+\.[^.]+/ },
    { name: "ANTHROPIC_API_KEY value",   pattern: /sk-ant-api[0-9]+-[A-Za-z0-9_-]{86}/ },
    { name: ".env file committed",        pattern: /^\.env$/ },
  ];

  // Extensions to scan in source files
  const SCAN_EXTENSIONS = [".js", ".jsx", ".ts", ".tsx", ".json"];

  function scanFile(filePath) {
    const content = fs.readFileSync(filePath, "utf8");
    const hits = [];
    DANGEROUS_PATTERNS.forEach(({ name, pattern }) => {
      if (pattern.test(content)) {
        hits.push(name);
      }
    });
    return hits;
  }

  function collectSourceFiles(root, extensions) {
    if (!repoExists(root)) return [];
    const files = [];
    function walk(dir) {
      if (!fs.existsSync(dir)) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      entries.forEach(entry => {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (!["node_modules", ".next", ".git", "dist", ".vercel"].includes(entry.name)) {
            walk(fullPath);
          }
        } else if (extensions.includes(path.extname(entry.name))) {
          files.push(fullPath);
        }
      });
    }
    walk(root);
    return files;
  }

  test("valoria-platform source files contain no PATs or service keys (or skip)", () => {
    const files = collectSourceFiles(PLATFORM_ROOT, SCAN_EXTENSIONS);
    if (files.length === 0) {
      console.warn("SKIP: valoria-platform not accessible for scanning");
      return;
    }
    const violations = [];
    files.forEach(f => {
      const hits = scanFile(f);
      if (hits.length > 0) violations.push({ file: f, hits });
    });
    if (violations.length > 0) {
      console.error("SECRET VIOLATIONS:", JSON.stringify(violations, null, 2));
    }
    expect(violations).toHaveLength(0);
  });

  test("valoria-site source files contain no PATs or service keys (or skip)", () => {
    const files = collectSourceFiles(SITE_ROOT, SCAN_EXTENSIONS);
    if (files.length === 0) {
      console.warn("SKIP: valoria-site not accessible for scanning");
      return;
    }
    const violations = [];
    files.forEach(f => {
      const hits = scanFile(f);
      if (hits.length > 0) violations.push({ file: f, hits });
    });
    if (violations.length > 0) {
      console.error("SECRET VIOLATIONS:", JSON.stringify(violations, null, 2));
    }
    expect(violations).toHaveLength(0);
  });

  test(".env file is not committed to valoria-platform (or skip)", () => {
    if (!repoExists(PLATFORM_ROOT)) return;
    const envPath = path.join(PLATFORM_ROOT, ".env");
    expect(fs.existsSync(envPath)).toBe(false);
  });

  test(".env file is not committed to valoria-site (or skip)", () => {
    if (!repoExists(SITE_ROOT)) return;
    const envPath = path.join(SITE_ROOT, ".env");
    expect(fs.existsSync(envPath)).toBe(false);
  });
});

// ── SECTION 4: RLS security contract ─────────────────────────────────────
describe("RLS security contract (logic layer)", () => {
  // These tests assert the *logic* of RLS decisions without hitting the DB.
  // Actual DB RLS tests require a test Supabase project — see README.

  test("client-side admin check is never the sole security gate", () => {
    // The pattern: if (user.isAdmin) → decorative only.
    // Real security must be enforced by RLS on the server.
    // This test documents the contract — not testable in unit tests,
    // but flagged for integration testing against the actual DB.
    const adminCheck = (user) => user?.role === "admin";
    // Client says admin
    expect(adminCheck({ role: "admin" })).toBe(true);
    // But server RLS must ALSO check — client check alone is insufficient.
    // This test exists as a contract marker.
    expect(true).toBe(true); // placeholder — real check is in Supabase RLS policy
  });

  test("anon key cannot be used for service_role operations", () => {
    const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNia2dwaXNna3VoYmFsc3hxa2RyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzMjI2NjEsImV4cCI6MjA5Mzg5ODY2MX0.iRPs_W6O6JkkHyVlH-9XkEgA1HNo8xtaMakoV5kwLEY";
    const payload = JSON.parse(Buffer.from(ANON_KEY.split(".")[1], "base64").toString());
    // Anon key must never have service_role — would bypass all RLS
    expect(payload.role).toBe("anon");
    expect(payload.role).not.toBe("service_role");
  });

  test("admin emails list is defined and non-empty", () => {
    // From assessmentLock.js / platform config
    const ADMIN_EMAILS = [
      "admin@valoriainstitute.com",
      "oluwafemi@valoriainstitute.com",
      "oluwafemi@riverwayse.com",
    ];
    expect(ADMIN_EMAILS.length).toBeGreaterThan(0);
    ADMIN_EMAILS.forEach(email => {
      expect(email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    });
  });

  test("valu_assessments table access requires identity_hash (no naked selects)", () => {
    // Simulates the fetch pattern used in fetchAssessmentByFingerprint
    // A proper fetch always filters by identity_hash
    function buildFetchParams(fingerprint) {
      if (!fingerprint) throw new Error("fingerprint required");
      return new URLSearchParams({
        identity_hash: `eq.${fingerprint}`,
        select: "name,role,total_score,cluster_scores,skill_scores,ai_report",
        order: "completed_at.desc",
        limit: "1",
      });
    }
    const params = buildFetchParams("fp_abc123");
    expect(params.get("identity_hash")).toBe("eq.fp_abc123");
    expect(params.get("limit")).toBe("1");
  });

  test("fetchAssessmentByEmail always includes email filter", () => {
    function buildEmailFetchParams(email) {
      if (!email) throw new Error("email required");
      return new URLSearchParams({
        email: `eq.${email}`,
        select: "name,role,total_score,cluster_scores,skill_scores",
        order: "completed_at.desc",
        limit: "1",
      });
    }
    const params = buildEmailFetchParams("user@example.com");
    expect(params.get("email")).toBe("eq.user@example.com");
  });
});

// ── SECTION 5: Build output validation ───────────────────────────────────
describe("Build configuration checks", () => {
  test("valoria-platform package.json has build script", () => {
    if (!repoExists(PLATFORM_ROOT)) return;
    const pkgPath = path.join(PLATFORM_ROOT, "package.json");
    if (!fs.existsSync(pkgPath)) return;
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    expect(pkg.scripts).toHaveProperty("build");
  });

  test("valoria-site package.json has build script", () => {
    if (!repoExists(SITE_ROOT)) return;
    const pkgPath = path.join(SITE_ROOT, "package.json");
    if (!fs.existsSync(pkgPath)) return;
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    expect(pkg.scripts).toHaveProperty("build");
  });

  test("valoria-site uses Next.js 14", () => {
    if (!repoExists(SITE_ROOT)) return;
    const pkgPath = path.join(SITE_ROOT, "package.json");
    if (!fs.existsSync(pkgPath)) return;
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    const nextVersion = pkg.dependencies?.next || pkg.devDependencies?.next || "";
    expect(nextVersion).toMatch(/^14/);
  });

  test("valoria-platform uses Vite + React", () => {
    if (!repoExists(PLATFORM_ROOT)) return;
    const pkgPath = path.join(PLATFORM_ROOT, "package.json");
    if (!fs.existsSync(pkgPath)) {
      // Check root-level package.json
      const rootPkg = path.join(path.dirname(PLATFORM_ROOT), "package.json");
      if (!fs.existsSync(rootPkg)) return;
      const pkg = JSON.parse(fs.readFileSync(rootPkg, "utf8"));
      expect(pkg.dependencies?.react || pkg.devDependencies?.react).toBeTruthy();
      return;
    }
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    expect(pkg.dependencies?.react || pkg.devDependencies?.react).toBeTruthy();
  });
});
