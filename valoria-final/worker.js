import tasterProgress from "./api/taster-progress.js";
import submitTaster from "./api/submit-taster.js";
import assessmentProgress from "./api/assessment-progress.js";
import submitAssessment from "./api/submit-assessment.js";
import linkAssessmentToTaster from "./api/link-assessment-to-taster.js";
import generateAndSendReport from "./api/generate-and-send-report.js";
import { GET as processReadinessQueue } from "./api/process-readiness-queue.js";
import sweepUnsentReports from "./api/sweep-unsent-reports.js";

const API_HANDLERS = new Map([
  ["/api/taster-progress", { handler: tasterProgress, nodeStyle: true }],
  ["/api/submit-taster", { handler: submitTaster, nodeStyle: true }],
  ["/api/assessment-progress", { handler: assessmentProgress, nodeStyle: false }],
  ["/api/submit-assessment", { handler: submitAssessment, nodeStyle: true }],
  ["/api/link-assessment-to-taster", { handler: linkAssessmentToTaster, nodeStyle: true }],
  ["/api/generate-and-send-report", { handler: generateAndSendReport, nodeStyle: false }],
  ["/api/process-readiness-queue", { handler: processReadinessQueue, nodeStyle: false }],
  ["/api/sweep-unsent-reports", { handler: sweepUnsentReports, nodeStyle: false }],
]);

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

async function toNodeRequest(request) {
  let body;
  if (request.method !== "GET" && request.method !== "HEAD") {
    const raw = await request.clone().text();
    if (raw) {
      const contentType = request.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        try {
          body = JSON.parse(raw);
        } catch {
          return { error: json({ error: "Invalid JSON request body." }, 400) };
        }
      } else {
        body = raw;
      }
    }
  }

  const headers = {};
  for (const [key, value] of request.headers.entries()) headers[key.toLowerCase()] = value;
  Object.defineProperty(headers, "get", {
    enumerable: false,
    value: (name) => request.headers.get(name),
  });

  const url = new URL(request.url);
  const forwardedFor = request.headers.get("x-forwarded-for");
  const remoteAddress = request.headers.get("cf-connecting-ip")
    || (forwardedFor ? forwardedFor.split(",")[0].trim() : "unknown");

  return {
    method: request.method,
    headers,
    body,
    query: Object.fromEntries(url.searchParams.entries()),
    url: url.pathname + url.search,
    originalUrl: url.pathname + url.search,
    socket: { remoteAddress },
    ip: remoteAddress,
  };
}

function createNodeResponse() {
  let statusCode = 200;
  let response;
  const headers = new Headers();

  const res = {
    status(code) {
      statusCode = Number(code) || 200;
      return this;
    },
    setHeader(name, value) {
      if (value !== undefined && value !== null) headers.set(name, String(value));
      return this;
    },
    getHeader(name) {
      return headers.get(name);
    },
    removeHeader(name) {
      headers.delete(name);
      return this;
    },
    json(data) {
      if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json; charset=utf-8");
      headers.set("Cache-Control", headers.get("Cache-Control") || "no-store");
      response = new Response(JSON.stringify(data), { status: statusCode, headers });
      return response;
    },
    send(data = "") {
      const body = typeof data === "string" || data instanceof ArrayBuffer ? data : JSON.stringify(data);
      if (typeof data !== "string" && !(data instanceof ArrayBuffer) && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json; charset=utf-8");
      }
      response = new Response(body, { status: statusCode, headers });
      return response;
    },
    end(data = null) {
      response = new Response(data, { status: statusCode, headers });
      return response;
    },
  };

  return { res, getResponse: () => response };
}

async function runNodeStyleHandler(handler, request) {
  const req = await toNodeRequest(request);
  if (req.error) return req.error;

  const { res, getResponse } = createNodeResponse();
  const returned = await handler(req, res);
  if (returned instanceof Response) return returned;
  return getResponse() || new Response(null, { status: 204 });
}

async function serveAssessmentAsset(request, env) {
  const url = new URL(request.url);
  let assetPath = url.pathname;

  if (assetPath === "/" || assetPath === "/remaining" || assetPath === "/remaining/"
    || assetPath === "/valu/assessment" || assetPath === "/valu/assessment/") {
    assetPath = "/index.html";
  } else if (assetPath.startsWith("/valu/assessment/")) {
    assetPath = assetPath.slice("/valu/assessment".length);
    // Vite's SPA routes should resolve to the app shell; real files retain their path.
    if (!assetPath || assetPath === "/" || !/\.[a-z0-9]+$/i.test(assetPath)) {
      assetPath = "/index.html";
    }
  } else if (assetPath.startsWith("/assets/") && !/\.[a-z0-9]+$/i.test(assetPath)) {
    assetPath = "/index.html";
  }

  url.pathname = assetPath;
  return env.ASSETS.fetch(new Request(url, request));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const route = API_HANDLERS.get(url.pathname);

    if (route) {
      try {
        return route.nodeStyle
          ? await runNodeStyleHandler(route.handler, request)
          : await route.handler(request);
      } catch (error) {
        // Do not log request bodies, tokens, participant identities, or secrets.
        console.error("[valoria-api] handler failed", {
          path: url.pathname,
          name: error?.name || "Error",
        });
        return json({ error: "The Valoria service is temporarily unavailable. Please try again." }, 500);
      }
    }

    if (url.pathname === "/" || url.pathname === "/remaining" || url.pathname === "/remaining/"
      || url.pathname === "/valu/assessment" || url.pathname.startsWith("/valu/assessment/")
      || url.pathname.startsWith("/assets/")) {
      return serveAssessmentAsset(request, env);
    }

    if (url.pathname.startsWith("/api/")) {
      return json({ error: "API endpoint not found." }, 404);
    }

    return env.ASSETS.fetch(request);
  },
};
