const [command, ...rawArgs] = process.argv.slice(2);
const options = {};

for (let index = 0; index < rawArgs.length; index += 2) {
  const key = rawArgs[index];
  if (!key?.startsWith("--") || rawArgs[index + 1] === undefined) {
    console.error(`Invalid argument: ${key || "missing value"}`);
    process.exit(1);
  }
  options[key.slice(2)] = rawArgs[index + 1];
}

function usage() {
  console.log(`Trackster Status incident manager

Commands:
  node admin.mjs list
  node admin.mjs create --service trackster-web --title "Title" --details "Details"
  node admin.mjs create --service router-api --title "Maintenance" --details "Completed" --status resolved --started "2026-11-01T01:00:00Z" --resolved "2026-11-01T01:30:00Z"
  node admin.mjs update --id manual-123 --status monitoring --details "Fix deployed"
  node admin.mjs resolve --id manual-123 --details "Service has recovered"

Public service IDs: trackster-web, trackster-api, router-web, router-api`);
}

if (!command || command === "help") {
  usage();
  process.exit(0);
}

const endpoint = `http://127.0.0.1:${process.env.PORT || 3000}/api/admin/incidents`;

if (command === "list") {
  const response = await fetch(endpoint);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed");
  if (!data.incidents.length) {
    console.log("No incidents recorded.");
  } else {
    console.table(data.incidents.map((incident) => ({
      id: incident.id,
      service: incident.serviceId,
      status: incident.status,
      started: incident.startedAt,
      title: incident.title,
    })));
  }
  process.exit(0);
}

if (!["create", "update", "resolve"].includes(command)) {
  usage();
  process.exit(1);
}

const response = await fetch(endpoint, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    action: command,
    id: options.id,
    serviceId: options.service,
    title: options.title,
    details: options.details,
    status: options.status,
    startedAt: options.started,
    resolvedAt: options.resolved,
  }),
});
const data = await response.json();
if (!response.ok) {
  console.error(data.error || "Request failed");
  process.exit(1);
}
console.log(`${data.incident.status}: ${data.incident.title}`);
console.log(`ID: ${data.incident.id}`);
