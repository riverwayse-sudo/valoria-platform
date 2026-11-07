"use strict";

import worker from "../../worker.js";

describe("isolated assessment staging API gate", () => {
  test("does not ship a legacy public Index.html that can shadow the Vite assessment app shell", () => {
    const legacyIndex = new URL("../../public/Index.html", import.meta.url);
    const canonicalIndex = new URL("../../index.html", import.meta.url);
    expect(() => require("node:fs").accessSync(legacyIndex)).toThrow();
    expect(require("node:fs").readFileSync(canonicalIndex, "utf8")).toContain("<title>Valoria Institute</title>");
  });

  test("blocks all routed assessment API actions while staging writes are disabled", async () => {
    const request = new Request("https://valoria-staging-assessment.example.workers.dev/api/taster-progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "register" })
    });
    const response = await worker.fetch(request, {
      VALU_PREVIEW: "1",
      VALU_STAGING_API_ENABLED: "0"
    });

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "This staging preview is read-only. Assessment actions are temporarily disabled; no data was changed."
    });
  });

  test("keeps the assessment application shell available in read-only preview", async () => {
    const assetFetch = jest.fn(async () => new Response("<main>VALU staging shell</main>", {
      headers: { "Content-Type": "text/html" }
    }));
    const request = new Request("https://valoria-staging-assessment.example.workers.dev/valu/assessment/");
    const response = await worker.fetch(request, {
      VALU_PREVIEW: "1",
      VALU_STAGING_API_ENABLED: "0",
      ASSETS: { fetch: assetFetch }
    });

    expect(response.status).toBe(200);
    expect(await response.text()).toContain("VALU staging shell");
    expect(assetFetch).toHaveBeenCalledTimes(1);
  });
});
