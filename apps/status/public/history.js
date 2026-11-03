function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[character]);
}

function formatDate(value, withTime = false) {
  return new Intl.DateTimeFormat("en", withTime
    ? { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", timeZoneName: "short" }
    : { month: "long", year: "numeric" }
  ).format(new Date(value));
}

function duration(incident) {
  if (!incident.resolvedAt) return "Ongoing";
  const minutes = Math.max(1, Math.round((new Date(incident.resolvedAt) - new Date(incident.startedAt)) / 60_000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} hr ${rest} min` : `${hours} hr`;
}

function incidentCard(incident, serviceName) {
  const updates = incident.updates?.length ? incident.updates : [{
    status: incident.status,
    details: incident.details,
    at: incident.resolvedAt || incident.startedAt,
  }];
  return `<article class="history-incident">
    <div class="history-incident-head">
      <div><h3>${escapeHtml(incident.title)}</h3><p>${escapeHtml(serviceName)} · ${formatDate(incident.startedAt, true)} · ${duration(incident)}</p></div>
      <span class="incident-state ${escapeHtml(incident.status)}">${escapeHtml(incident.status)}</span>
    </div>
    <div class="incident-updates">
      ${[...updates].reverse().map((update) => `<div class="incident-update">
        <span class="update-dot ${escapeHtml(update.status)}"></span>
        <div><div><strong>${escapeHtml(update.status)}</strong><time>${formatDate(update.at, true)}</time></div><p>${escapeHtml(update.details)}</p></div>
      </div>`).join("")}
    </div>
  </article>`;
}

async function load() {
  const response = await fetch("/api/status", { cache: "no-store" });
  if (!response.ok) throw new Error("Status request failed");
  const data = await response.json();
  const serviceNames = new Map(data.services.map((service) => [service.id, service.name]));
  const container = document.querySelector("#history-list");

  if (!data.incidents.length) {
    container.innerHTML = `<div class="history-empty"><span>✓</span><h2>No incidents recorded</h2><p>Automated outages, recovery notes, and scheduled maintenance will appear here.</p></div>`;
    return;
  }

  const groups = new Map();
  data.incidents.forEach((incident) => {
    const month = formatDate(incident.startedAt);
    if (!groups.has(month)) groups.set(month, []);
    groups.get(month).push(incident);
  });
  container.innerHTML = [...groups.entries()].map(([month, incidents]) => `
    <section class="history-month"><h2>${escapeHtml(month)}</h2><div>${incidents.map((incident) => incidentCard(incident, serviceNames.get(incident.serviceId) || "Trackster")).join("")}</div></section>
  `).join("");
}

load().catch(() => {
  document.querySelector("#history-list").innerHTML = '<div class="history-empty"><h2>History unavailable</h2><p>Please try again shortly.</p></div>';
});
