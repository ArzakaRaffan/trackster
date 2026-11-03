const DAY_MS = 86_400_000;
const today = new Date();
today.setUTCHours(0, 0, 0, 0);

function day(offset) {
  return new Date(today.getTime() + offset * DAY_MS).toISOString().slice(0, 10);
}

function at(offset, hour, minute) {
  const value = new Date(today.getTime() + offset * DAY_MS);
  value.setUTCHours(hour, minute, 0, 0);
  return value.toISOString();
}

const services = ["trackster-web", "trackster-api", "router-web", "router-api"];
const histories = Object.fromEntries(services.map((serviceId) => [
  serviceId,
  Array.from({ length: 30 }, (_, index) => ({ day: day(index - 29), status: "operational" })),
]));

const dailyEvents = [
  ["trackster-api", -24, "degraded"],
  ["router-api", -21, "degraded"],
  ["trackster-api", -17, "outage"],
  ["router-api", -13, "outage"],
  ["router-web", -11, "degraded"],
  ["trackster-web", -7, "degraded"],
  ["router-api", -4, "degraded"],
];

for (const [serviceId, offset, status] of dailyEvents) {
  const item = histories[serviceId].find((entry) => entry.day === day(offset));
  if (item) item.status = status;
}

function incident({ key, serviceId, title, offset, start, monitoring, end, investigating, monitoringNote, resolved }) {
  const startedAt = at(offset, ...start);
  const resolvedAt = at(offset, ...end);
  return {
    id: `historical-${day(offset)}-${key}`,
    serviceId,
    title,
    startedAt,
    resolvedAt,
    details: resolved,
    updates: [
      { status: "investigating", details: investigating, at: startedAt },
      { status: "monitoring", details: monitoringNote, at: at(offset, ...monitoring) },
      { status: "resolved", details: resolved, at: resolvedAt },
    ],
  };
}

const incidents = [
  incident({
    key: "transaction-sync-delay",
    serviceId: "trackster-api",
    title: "Delayed transaction synchronization",
    offset: -24,
    start: [2, 14], monitoring: [2, 31], end: [2, 46],
    investigating: "Some newly imported transactions were taking longer than expected to appear.",
    monitoringNote: "Queue throughput recovered after a worker restart. We continued monitoring pending jobs.",
    resolved: "The transaction queue was fully processed and synchronization returned to normal.",
  }),
  incident({
    key: "gateway-latency",
    serviceId: "router-api",
    title: "Elevated API gateway latency",
    offset: -21,
    start: [9, 8], monitoring: [9, 19], end: [9, 31],
    investigating: "Requests through the gateway were experiencing elevated response times in one region.",
    monitoringNote: "Traffic was redistributed across healthy upstreams and latency began returning to normal.",
    resolved: "Gateway latency recovered across all routes. No requests or configuration data were lost.",
  }),
  incident({
    key: "receipt-processing-errors",
    serviceId: "trackster-api",
    title: "Receipt processing errors",
    offset: -17,
    start: [4, 22], monitoring: [4, 49], end: [5, 3],
    investigating: "A subset of receipt uploads could not be processed by the extraction worker.",
    monitoringNote: "A parsing fix was deployed and failed receipts were queued for automatic retry.",
    resolved: "Receipt processing recovered and all queued uploads completed successfully.",
  }),
  incident({
    key: "intermittent-502",
    serviceId: "router-api",
    title: "Intermittent 502 responses at the gateway",
    offset: -13,
    start: [13, 5], monitoring: [13, 18], end: [13, 29],
    investigating: "Some API routes were intermittently returning 502 responses during upstream connection reuse.",
    monitoringNote: "The affected upstream pool was recycled and error rates dropped to baseline.",
    resolved: "Gateway traffic remained stable and the incident was resolved.",
  }),
  incident({
    key: "router-metrics-delay",
    serviceId: "router-web",
    title: "Router dashboard metrics delayed",
    offset: -11,
    start: [7, 41], monitoring: [7, 57], end: [8, 12],
    investigating: "Gateway metrics were healthy but appeared late in the Router dashboard.",
    monitoringNote: "The metrics consumer caught up after its connection was refreshed.",
    resolved: "Dashboard metrics are current and updating normally.",
  }),
  incident({
    key: "dashboard-total-delay",
    serviceId: "trackster-web",
    title: "Dashboard totals briefly delayed",
    offset: -7,
    start: [11, 32], monitoring: [11, 47], end: [11, 59],
    investigating: "Account totals were briefly showing cached values after new transactions were added.",
    monitoringNote: "Cache invalidation was corrected and fresh totals were being served.",
    resolved: "Dashboard totals are updating normally. No transaction data was affected.",
  }),
  incident({
    key: "route-propagation-delay",
    serviceId: "router-api",
    title: "Route configuration propagation delay",
    offset: -4,
    start: [16, 3], monitoring: [16, 21], end: [16, 38],
    investigating: "New route changes were taking longer than expected to reach all gateway instances.",
    monitoringNote: "The propagation queue was drained and configuration versions converged.",
    resolved: "Route changes are propagating normally across every gateway instance.",
  }),
];

const endpoint = `http://127.0.0.1:${process.env.PORT || 3000}/api/admin/incidents`;
const response = await fetch(endpoint, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ action: "seed", histories, incidents }),
});
const result = await response.json();
if (!response.ok) {
  console.error(result.error || "Could not seed status history");
  process.exit(1);
}
console.log(`Status history ready: ${result.added} incidents added, ${result.incidents} total.`);
