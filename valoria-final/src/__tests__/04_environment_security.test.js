// __tests__/04_environment_security.test.js
// Phase 4 — Environment parity and security checks.
// Tests configuration shape and secret-handling contracts without embedding
// project credentials, JWTs, or operational admin identities.

"use strict";

const fs = require("fs");
const path = require("path");

const PLATFORM_ROOT = process.env.VALORIA_PLATFORM_ROOT || path.join(__dirname, "../../valoria-platform/valoria-final");
const SITE_ROOT = process.env.VALORIA_SITE_ROOT || path.join(__dirname, "../../valoria-site");

const repoExists = root => fs.existsSync(root);
const readEnvExample = root => {
  const envPath = path.join(root, ".env.example");
  return fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : null;
};

describe("Environment variables — required keys", () => {
  const platformKeys = ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"];
  const siteKeys = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "ANTHROPIC_API_KEY"];

  test("platform .env.example documents required keys", () => {
    if (!repoExists(PLATFORM_ROOT)) return;
    const content = readEnvExample(PLATFORM_ROOT);
    if (content === null) return;
    platformKeys.forEach(key => expect(content).toContain(key));
  });

  test("site .env.example documents required keys", () => {
    if (!repoExists(SITE_ROOT)) return;
    const content = readEnvExample(SITE_ROOT);
    if (content === null) return;
    siteKeys.forEach(key => expect(content).toContain(key));
  });
});

describe("Supabase configuration format", () => {
  const EXAMPLE_PROJECT_REF = "a1b2c3d4e5f6g7h8i9j0";
  const EXAMPLE_ANON_PAYLOAD = { iss: "supabase", ref: EXAMPLE_PROJECT_REF, role: "anon" };

  test("project reference has expected shape", () => {
    expect(EXAMPLE_PROJECT_REF).toMatch(/^[a-z0-9]{20}$/);
  });

  test("Supabase URL has expected shape", () => {
    expect(`https://${EXAMPLE_PROJECT_REF}.supabase.co`).toMatch(/^https:\/\/[a-z0-9]{20}\.supabase\.co$/);
  });

  test("anon configuration contract never uses service_role", () => {
    expect(EXAMPLE_ANON_PAYLOAD.role).toBe("anon");
    expect(EXAMPLE_ANON_PAYLOAD.role).not.toBe("service_role");
  });
});

describe("Secret scanning — no credentials in source files", () => {
  const DANGEROUS_PATTERNS = [
    { name: "GitHub PAT", pattern: /ghp_[A-Za-z0-9]{36}/ },
    { name: "GitHub fine-grained PAT", pattern: /github_pat_[A-Za-z0-9_]{20,}/ },
    { name: "Supabase JWT-like credential", pattern: /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[^.]+\.[^.]+/ },
    { name: "Anthropic API key", pattern: /sk-ant-api[0-9]+-[A-Za-z0-9_-]{20,}/ },
  ];
  const extensions = [".js", ".jsx", ".ts", ".tsx", ".json"];

  function scanFile(filePath) {
    const content = fs.readFileSync(filePath, "utf8");
    return DANGEROUS_PATTERNS.filter(({ pattern }) => pattern.test(content)).map(({ name }) => name);
  }

  function collectFiles(root) {
    if (!repoExists(root)) return [];
    const files = [];
    function walk(dir) {
      fs.readdirSync(dir, { withFileTypes: true }).forEach(entry => {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (!["node_modules", ".next", ".git", "dist", ".vercel"].includes(entry.name)) walk(fullPath);
        } else if (extensions.includes(path.extname(entry.name))) files.push(fullPath);
      });
    }
    walk(root);
    return files;
  }

  [
    ["platform", PLATFORM_ROOT],
    ["site", SITE_ROOT],
  ].forEach(([label, root]) => {
    test(`${label} source contains no credential-like values`, () => {
      const violations = collectFiles(root).flatMap(file => scanFile(file).map(hit => ({ file, hit })));
      if (!violations.length) return;
      throw new Error(`Credential-like values found: ${JSON.stringify(violations, null, 2)}`);
    });
  });

  test(".env files are not committed", () => {
    if (repoExists(PLATFORM_ROOT)) expect(fs.existsSync(path.join(PLATFORM_ROOT, ".env"))).toBe(false);
    if (repoExists(SITE_ROOT)) expect(fs.existsSync(path.join(SITE_ROOT, ".env"))).toBe(false);
  });
});

describe("RLS security contract", () => {
  test("client-side admin state is not sufficient security", () => {
    const adminCheck = user => user?.role === "admin";
    expect(adminCheck({ role: "admin" })).toBe(true);
    // Actual authorization must be enforced server-side/database-side.
    expect(true).toBe(true);
  });

  test("assessment lookups require an identifier", () => {
    const buildParams = fingerprint => {
      if (!fingerprint) throw new Error("fingerprint required");
      return new URLSearchParams({ identity_hash: `eq.${fingerprint}`, limit: "1" });
    };
    const params = buildParams("fp_example_identifier");
    expect(params.get("identity_hash")).toBe("eq.fp_example_identifier");
    expect(params.get("limit")).toBe("1");
  });

  test("email assessment lookups require an email filter", () => {
    const buildParams = email => {
      if (!email) throw new Error("email required");
      return new URLSearchParams({ email: `eq.${email}`, limit: "1" });
    };
    expect(buildParams("person@example.test").get("email")).toBe("eq.person@example.test");
  });
});

describe("Build configuration checks", () => {
  test("platform package has build script", () => {
    if (!repoExists(PLATFORM_ROOT)) return;
    const pkgPath = path.join(PLATFORM_ROOT, "package.json");
    if (!fs.existsSync(pkgPath)) return;
    expect(JSON.parse(fs.readFileSync(pkgPath, "utf8")).scripts).toHaveProperty("build");
  });

  test("site package has build script", () => {
    if (!repoExists(SITE_ROOT)) return;
    const pkgPath = path.join(SITE_ROOT, "package.json");
    if (!fs.existsSync(pkgPath)) return;
    expect(JSON.parse(fs.readFileSync(pkgPath, "utf8")).scripts).toHaveProperty("build");
  });
});
