import { createServer } from "node:http";
import { readFile, rename, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PORT = Number(process.env.PORT || 3000);
const DATA_PATH = process.env.DATA_PATH || "/data/status.json";
const CHECK_INTERVAL_MS = 60_000;
const CHECK_TIMEOUT_MS = 10_000;
const HISTORY_DAYS = 30;
const PUBLIC_DIR = fileURLToPath(new URL("./public", import.meta.url));

const services = [
  {
    id: "trackster-web",
    name: "Trackster",
    description: "Web application",
    url: "https://trackster.dev",
    public: true,
  },
  {
    id: "trackster-api",
    name: "Trackster API",
    description: "Core application services",
    url: "https://api.trackster.dev",
    public: true,
  },
  {
    id: "router-web",
    name: "Router",
    description: "Router control plane",
    url: "https://router.trackster.dev",
    public: true,
  },
  {
    id: "router-api",
    name: "Router API",
    description: "Routing and edge services",
    url: "https://api.router.trackster.dev",
    public: true,
  },
  {
    id: "trackster-panel",
    name: "Trackster Panel",
    description: "Private owner panel",
    url: process.env.PANEL_URL || "https://panel.trackster.dev",
    public: false,
  },
];

const statusWeight = { operational: 0, degraded: 1, outage: 2 };
let state = { version: 1, checkedAt: null, services: {}, incidents: [] };
let checking = false;

function today() {
  return new Date().toISOString().slice(0, 10);
}

function oldestRetainedDay() {
  return new Date(Date.now() - (HISTORY_DAYS - 1) * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

async function loadState() {
  try {
    const stored = JSON.parse(await readFile(DATA_PATH, "utf8"));
    if (stored?.version === 1 && stored.services && Array.isArray(stored.incidents)) {
      state = stored;
    }
  } catch (error) {
    if (error.code !== "ENOENT") console.error("Could not load status data:", error.message);
  }
}

async function saveState() {
  const temporaryPath = `${DATA_PATH}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
  await rename(temporaryPath, DATA_PATH);
}

async function checkService(service) {
  const startedAt = performance.now();
  try {
    const response = await fetch(service.url, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
      headers: {
        accept: "text/html,application/json;q=0.9,*/*;q=0.8",
        "user-agent": "Trackster-Status/1.0 (+https://status.trackster.dev)",
      },
    });
    const latency = Math.round(performance.now() - startedAt);
    await response.body?.cancel().catch(() => {});
    const reachable = response.status < 500;
    return {
      status: !reachable ? "outage" : latency > 2_500 ? "degraded" : "operational",
      latency,
      statusCode: response.status,
      error: reachable ? null : `HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      status: "outage",
      latency: Math.round(performance.now() - startedAt),
      statusCode: null,
      error: error.name === "TimeoutError" ? "Request timed out" : "Connection failed",
    };
  }
}

function updateHistory(previous = [], currentStatus) {
  const cutoff = oldestRetainedDay();
  const day = today();
  const history = previous.filter((item) => item.day >= cutoff && item.day !== day);
  const existing = previous.find((item) => item.day === day)?.status;
  const dailyStatus = existing && statusWeight[existing] > statusWeight[currentStatus]
    ? existing
    : currentStatus;
  history.push({ day, status: dailyStatus });
  return history.sort((a, b) => a.day.localeCompare(b.day));
}

function updateIncident(service, previousStatus, result, checkedAt) {
  if (!service.public) return;

  const active = state.incidents.find(
    (incident) => incident.serviceId === service.id
      && incident.status !== "resolved"
      && incident.source !== "manual",
  );

  if (result.status === "operational" && active) {
    active.status = "resolved";
    active.resolvedAt = checkedAt;
    active.details = `${service.name} has recovered and is operating normally.`;
    active.updates = [
      ...(active.updates || []),
      { status: "resolved", details: active.details, at: checkedAt },
    ];
    return;
  }

  if (result.status !== "operational" && !active) {
    const details = result.error
      ? `Automated monitoring detected: ${result.error}.`
      : `Automated monitoring detected elevated response time (${result.latency} ms).`;
    state.incidents.unshift({
      id: `${service.id}-${Date.now()}`,
      serviceId: service.id,
      title: result.status === "outage" ? `${service.name} outage` : `${service.name} is degraded`,
      status: "investigating",
      startedAt: checkedAt,
      resolvedAt: null,
      details,
      source: "automatic",
      updates: [{ status: "investigating", details, at: checkedAt }],
    });
    return;
  }

  if (active && previousStatus !== result.status) {
    active.title = result.status === "outage" ? `${service.name} outage` : `${service.name} is degraded`;
    active.details = result.error
      ? `Automated monitoring detected: ${result.error}.`
      : `Automated monitoring detected elevated response time (${result.latency} ms).`;
    active.updates = [
      ...(active.updates || []),
      { status: "investigating", details: active.details, at: checkedAt },
    ];
  }
}

function isLoopback(request) {
  return ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(request.socket.remoteAddress);
}

async function readJsonBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 32_768) throw new Error("Request body is too large");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(body));
}

async function manageIncident(request, response) {
  if (!isLoopback(request)) {
    sendJson(response, 404, { error: "Not found" });
    return;
  }

  if (request.method === "GET") {
    sendJson(response, 200, { incidents: state.incidents });
    return;
  }

  if (request.method !== "POST") {
    sendJson(response, 405, { error: "Method not allowed" });
    return;
  }

  try {
    const body = await readJsonBody(request);
    const allowedStatuses = ["investigating", "monitoring", "resolved"];

    if (body.action === "seed") {
      const dailyStatuses = ["operational", "degraded", "outage"];
      for (const service of services.filter((item) => item.public)) {
        const history = Array.isArray(body.histories?.[service.id])
          ? body.histories[service.id].filter((item) =>
            /^\d{4}-\d{2}-\d{2}$/.test(item.day) && dailyStatuses.includes(item.status),
          ).slice(-HISTORY_DAYS)
          : null;
        if (history) {
          state.services[service.id] ||= {};
          state.services[service.id].history = history.sort((a, b) => a.day.localeCompare(b.day));
        }
      }

      let added = 0;
      for (const candidate of Array.isArray(body.incidents) ? body.incidents : []) {
        const service = services.find((item) => item.public && item.id === candidate.serviceId);
        if (!service || !candidate.id || !candidate.title || !candidate.details) continue;
        if (state.incidents.some((item) => item.id === candidate.id)) continue;
        const updates = Array.isArray(candidate.updates)
          ? candidate.updates.filter((update) =>
            allowedStatuses.includes(update.status) && update.details && update.at,
          ).map((update) => ({
            status: update.status,
            details: String(update.details),
            at: new Date(update.at).toISOString(),
          }))
          : [];
        state.incidents.push({
          id: String(candidate.id),
          serviceId: service.id,
          title: String(candidate.title),
          status: "resolved",
          startedAt: new Date(candidate.startedAt).toISOString(),
          resolvedAt: new Date(candidate.resolvedAt).toISOString(),
          details: String(candidate.details),
          source: "historical",
          updates,
        });
        added += 1;
      }
      state.incidents.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
      state.incidents = state.incidents.slice(0, 100);
      await saveState();
      sendJson(response, 200, { added, incidents: state.incidents.length });
      return;
    }

    if (body.action === "create") {
      const service = services.find((item) => item.public && item.id === body.serviceId);
      if (!service || !body.title?.trim() || !body.details?.trim()) {
        sendJson(response, 400, { error: "A public service, title, and details are required" });
        return;
      }
      const status = allowedStatuses.includes(body.status) ? body.status : "investigating";
      const startedAt = body.startedAt ? new Date(body.startedAt).toISOString() : new Date().toISOString();
      const resolvedAt = status === "resolved"
        ? (body.resolvedAt ? new Date(body.resolvedAt).toISOString() : new Date().toISOString())
        : null;
      const incident = {
        id: `manual-${Date.now()}`,
        serviceId: service.id,
        title: body.title.trim(),
        status,
        startedAt,
        resolvedAt,
        details: body.details.trim(),
        source: "manual",
        updates: [{ status, details: body.details.trim(), at: resolvedAt || startedAt }],
      };
      state.incidents.unshift(incident);
      state.incidents.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
      state.incidents = state.incidents.slice(0, 100);
      await saveState();
      sendJson(response, 201, { incident });
      return;
    }

    const incident = state.incidents.find((item) => item.id === body.id);
    if (!incident) {
      sendJson(response, 404, { error: "Incident not found" });
      return;
    }

    if (body.action === "update" || body.action === "resolve") {
      const status = body.action === "resolve" ? "resolved" : body.status;
      if (!allowedStatuses.includes(status)) {
        sendJson(response, 400, { error: "Status must be investigating, monitoring, or resolved" });
        return;
      }
      const at = body.resolvedAt ? new Date(body.resolvedAt).toISOString() : new Date().toISOString();
      const details = body.details?.trim() || incident.details;
      incident.status = status;
      incident.details = details;
      if (body.title?.trim()) incident.title = body.title.trim();
      incident.resolvedAt = status === "resolved" ? at : null;
      incident.updates = [...(incident.updates || []), { status, details, at }];
      await saveState();
      sendJson(response, 200, { incident });
      return;
    }

    sendJson(response, 400, { error: "Unknown action" });
  } catch (error) {
    sendJson(response, 400, { error: error.message });
  }
}

async function runChecks() {
  if (checking) return;
  checking = true;
  try {
    const checkedAt = new Date().toISOString();
    const results = await Promise.all(services.map(checkService));

    services.forEach((service, index) => {
      const previous = state.services[service.id];
      const result = results[index];
      updateIncident(service, previous?.status, result, checkedAt);
      state.services[service.id] = {
        status: result.status,
        latency: result.latency,
        statusCode: result.statusCode,
        error: result.error,
        checkedAt,
        history: updateHistory(previous?.history, result.status),
      };
    });

    state.checkedAt = checkedAt;
    state.incidents = state.incidents.slice(0, 100);
    await saveState();
    console.log(`Checked ${services.length} services at ${checkedAt}`);
  } catch (error) {
    console.error("Status check failed:", error);
  } finally {
    checking = false;
  }
}

function publicStatus() {
  const publicServices = services.filter((service) => service.public).map((service) => ({
    id: service.id,
    name: service.name,
    description: service.description,
    url: service.url,
    ...(state.services[service.id] || {
      status: "outage",
      latency: null,
      statusCode: null,
      history: [],
    }),
    error: undefined,
    checkedAt: undefined,
  }));
  const overall = publicServices.reduce(
    (worst, service) => statusWeight[service.status] > statusWeight[worst] ? service.status : worst,
    "operational",
  );

  return {
    checkedAt: state.checkedAt,
    overall,
    services: publicServices,
    incidents: state.incidents.filter((incident) =>
      services.some((service) => service.public && service.id === incident.serviceId),
    ),
  };
}

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
};

function setSecurityHeaders(response) {
  response.setHeader("Content-Security-Policy", "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'");
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
}

const server = createServer(async (request, response) => {
  setSecurityHeaders(response);
  const pathname = new URL(request.url || "/", "http://localhost").pathname;

  if (pathname === "/healthz") {
    response.writeHead(200, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" });
    response.end("ok\n");
    return;
  }

  if (pathname === "/api/status") {
    response.writeHead(200, {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store, max-age=0",
    });
    response.end(JSON.stringify(publicStatus()));
    return;
  }

  if (pathname === "/api/admin/incidents") {
    await manageIncident(request, response);
    return;
  }

  const pageRoutes = {
    "/": "index.html",
    "/history": "history.html",
    "/history/": "history.html",
    "/uptime": "uptime.html",
    "/uptime/": "uptime.html",
  };
  const requestedFile = pageRoutes[pathname] || pathname.slice(1);
  if (!/^[a-zA-Z0-9._-]+$/.test(requestedFile)) {
    response.writeHead(404).end("Not found\n");
    return;
  }

  try {
    const file = await readFile(join(PUBLIC_DIR, requestedFile));
    response.writeHead(200, {
      "content-type": contentTypes[extname(requestedFile)] || "application/octet-stream",
      "cache-control": "no-cache",
    });
    response.end(file);
  } catch {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found\n");
  }
});

await loadState();
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Trackster Status listening on :${PORT}`);
});
await runChecks();
const timer = setInterval(runChecks, CHECK_INTERVAL_MS);

function shutdown() {
  clearInterval(timer);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5_000).unref();
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
