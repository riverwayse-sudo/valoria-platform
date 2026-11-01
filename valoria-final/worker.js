import assessmentProgress from "./api/assessment-progress.js";
import claimListing from "./api/claim-listing.js";
import claimTaster from "./api/claim-taster.js";
import createAccount from "./api/create-account.js";
import finalizeReport from "./api/finalize-report.js";
import generateAndSendReport from "./api/generate-and-send-report.js";
import getAssessmentData from "./api/get-assessment-data.js";
import linkAssessmentToTaster from "./api/link-assessment-to-taster.js";
import notifications from "./api/notifications.js";
import processReadinessQueue from "./api/process-readiness-queue.js";
import reconciliationHealth from "./api/reconciliation-health.js";
import report from "./api/report.js";
import resendConfirmation from "./api/resend-confirmation.js";
import saveReport from "./api/save-report.js";
import sendEmail from "./api/send-email.js";
import sendProfileReminder from "./api/send-profile-reminder.js";
import submitAssessment from "./api/submit-assessment.js";
import submitTaster from "./api/submit-taster.js";
import sweepUnsentReports from "./api/sweep-unsent-reports.js";
import systemStatus from "./api/system-status.js";
import tasterProgress from "./api/taster-progress.js";
import updateAssessment from "./api/update-assessment.js";

const routes = {
  "assessment-progress": assessmentProgress,
  "claim-listing": claimListing,
  "claim-taster": claimTaster,
  "create-account": createAccount,
  "finalize-report": finalizeReport,
  "generate-and-send-report": generateAndSendReport,
  "get-assessment-data": getAssessmentData,
  "link-assessment-to-taster": linkAssessmentToTaster,
  notifications,
  "process-readiness-queue": processReadinessQueue,
  "reconciliation-health": reconciliationHealth,
  report,
  "resend-confirmation": resendConfirmation,
  "save-report": saveReport,
  "send-email": sendEmail,
  "send-profile-reminder": sendProfileReminder,
  "submit-assessment": submitAssessment,
  "submit-taster": submitTaster,
  "sweep-unsent-reports": sweepUnsentReports,
  "system-status": systemStatus,
  "taster-progress": tasterProgress,
  "update-assessment": updateAssessment,
};

function headerProxy(headers) {
  return new Proxy(headers, {
    get(target, property) {
      if (typeof property === "string" && !(property in target)) return target.get(property.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase()));
      const value = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

function createVercelResponse() {
  const headers = new Headers();
  let statusCode = 200;
  let body = null;
  let ended = false;
  const response = {
    get statusCode() { return statusCode; },
    set statusCode(value) { statusCode = Number(value) || 200; },
    get headersSent() { return ended; },
    status(value) { statusCode = Number(value) || 200; return response; },
    setHeader(name, value) { headers.set(name, Array.isArray(value) ? value.join(", ") : String(value)); return response; },
    getHeader(name) { return headers.get(name); },
    removeHeader(name) { headers.delete(name); return response; },
    json(value) { headers.set("Content-Type", "application/json; charset=utf-8"); body = JSON.stringify(value); ended = true; return response; },
    send(value) { body = value; ended = true; return response; },
    end(value) { if (value !== undefined) body = value; ended = true; return response; },
    writeHead(code, values = {}) { statusCode = Number(code) || 200; for (const [key, value] of Object.entries(values)) headers.set(key, String(value)); return response; },
    toResponse() {
      return new Response(body, { status: statusCode, headers });
    },
  };
  return response;
}

async function invoke(handler, request) {
  if (handler.length <= 1) {
    const result = await handler(request);
    if (result instanceof Response) return result;
    return Response.json(result ?? { ok: true });
  }

  const url = new URL(request.url);
  let parsedBody;
  if (!["GET", "HEAD"].includes(request.method)) {
    const raw = await request.clone().text();
    if (raw) {
      try { parsedBody = JSON.parse(raw); }
      catch { parsedBody = raw; }
    }
  }
  const req = {
    method: request.method,
    url: request.url,
    originalUrl: request.url,
    headers: headerProxy(request.headers),
    body: parsedBody,
    query: Object.fromEntries(url.searchParams.entries()),
    ip: request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown",
    socket: { remoteAddress: request.headers.get("cf-connecting-ip") || "unknown" },
  };
  const res = createVercelResponse();
  const result = await handler(req, res);
  if (result instanceof Response) return result;
  if (res.headersSent) return res.toResponse();
  if (result !== undefined) return Response.json(result);
  return res.toResponse();
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) {
      if (url.pathname === "/valu/assessment" || url.pathname === "/valu/assessment/") {
        const assetUrl = new URL("/index.html", url.origin);
        return env.ASSETS.fetch(new Request(assetUrl, request));
      }
      if (url.pathname.startsWith("/valu/assessment/")) {
        const assetPath = url.pathname.replace(/^\/valu\/assessment/, "") || "/";
        const assetUrl = new URL(assetPath, url.origin);
        const assetResponse = await env.ASSETS.fetch(new Request(assetUrl, request));
        if (assetResponse.status !== 404) return assetResponse;
        const indexResponse = await env.ASSETS.fetch(new Request(new URL("/index.html", url.origin), request));
        return indexResponse.status === 200 ? indexResponse : assetResponse;
      }
      return new Response("Not found", { status: 404 });
    }

    const name = url.pathname.slice(5).replace(/\/$/, "");
    const handler = routes[name];
    if (!handler) return Response.json({ error: "Not found" }, { status: 404 });
    try {
      return await invoke(handler, request);
    } catch (error) {
      console.error("Valoria API worker failure", name, error?.name || "Error");
      return Response.json({ error: "The service is temporarily unavailable." }, { status: 500, headers: { "Cache-Control": "no-store" } });
    }
  },

  async scheduled(event, env, ctx) {
    const routeName = event.cron === "0 2 * * *" ? "sweep-unsent-reports"
      : event.cron === "0 3 * * *" ? "assessment-progress" : null;
    if (!routeName || !routes[routeName]) return;
    const request = new Request(`https://internal/api/${routeName}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${env.CRON_SECRET || ""}` },
    });
    ctx.waitUntil(invoke(routes[routeName], request).catch((error) => {
      console.error("Valoria scheduled task failed", routeName, error?.name || "Error");
    }));
  },
};
