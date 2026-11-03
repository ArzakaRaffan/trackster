const labels = {
  operational: "Operational",
  degraded: "Degraded performance",
  outage: "Major outage",
};

const overallCopy = {
  operational: "All systems operational",
  degraded: "Some systems are degraded",
  outage: "We’re experiencing an outage",
};

const statusIcons = {
  operational: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="m5 12 4 4L19 6"/></svg>',
  degraded: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 12h4l2-7 4 14 2-7h6"/></svg>',
  outage: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="m3 3 18 18M8.5 8.5A5 5 0 0 0 7 12v1m8.5 2.5A5 5 0 0 0 17 12v-1M12 19v2M5 19h14"/></svg>',
};

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[character]);
}

function formatTime(value) {
  if (!value) return "Checking now";
  return new Intl.DateTimeFormat("en", {
    hour: "2-digit", minute: "2-digit", second: "2-digit", timeZoneName: "short",
  }).format(new Date(value));
}

function uptimeMarkup(service) {
  const stored = new Map((service.history || []).map((item) => [item.day, item.status]));
  const days = Array.from({ length: 90 }, (_, index) => {
    const date = new Date(Date.now() - (89 - index) * 86_400_000).toISOString().slice(0, 10);
    return { date, status: stored.get(date) || (index === 89 ? service.status : "unknown") };
  });
  const recorded = days.filter((day) => day.status !== "unknown");
  const uptime = recorded.length
    ? recorded.filter((day) => day.status === "operational").length / recorded.length * 100
    : null;

  return `
    <div class="uptime-wrap">
      <div class="uptime-strip" aria-label="90 day uptime history">
        ${days.map((day) => `<span class="uptime-day ${day.status}" title="${day.date}: ${labels[day.status] || "No data yet"}"></span>`).join("")}
      </div>
      <div class="uptime-meta"><span>90 days ago</span><span class="history-note">${uptime === null ? "Monitoring starts today" : `${uptime.toFixed(2)}% uptime`}</span><span>Today</span></div>
    </div>`;
}

function renderServices(services) {
  document.querySelector("#service-list").innerHTML = services.map((service) => `
    <article class="service-row">
      <div class="service-main">
        <div class="service-icon ${service.status}">${statusIcons[service.status]}</div>
        <div><h3>${escapeHtml(service.name)}</h3><p>${escapeHtml(service.description)}</p></div>
      </div>
      <div class="service-result">
        ${service.latency !== null ? `<span>${service.latency} ms</span>` : ""}
        <strong class="${service.status}">${labels[service.status]}</strong>
      </div>
      ${uptimeMarkup(service)}
    </article>`).join("");
}

function renderIncidents(incidents) {
  const container = document.querySelector("#incident-list");
  if (!incidents.length) {
    const now = new Date();
    container.innerHTML = `<article class="incident-empty">
      <div class="incident-date"><span>${new Intl.DateTimeFormat("en", { month: "short" }).format(now)}</span><strong>${now.getDate()}</strong></div>
      <div><h3>No incidents reported today</h3><p>When something changes, updates and resolution notes will appear here.</p></div>
      <div class="shield" aria-hidden="true">✓</div>
    </article>`;
    return;
  }

  container.innerHTML = `<div class="incident-list">${incidents.map((incident) => {
    const date = new Date(incident.startedAt);
    return `<article class="incident-record">
      <div class="incident-date"><span>${new Intl.DateTimeFormat("en", { month: "short" }).format(date)}</span><strong>${date.getDate()}</strong></div>
      <div><div class="incident-title-line"><h3>${escapeHtml(incident.title)}</h3><span class="${escapeHtml(incident.status)}">${escapeHtml(incident.status)}</span></div>
      <p>${escapeHtml(incident.details)}</p><time>${formatTime(incident.resolvedAt || incident.startedAt)}</time></div>
    </article>`;
  }).join("")}</div>`;
}

async function loadStatus(manual = false) {
  const refresh = document.querySelector("#refresh");
  if (manual) refresh.classList.add("spin");
  try {
    const response = await fetch("/api/status", { cache: "no-store" });
    if (!response.ok) throw new Error("Status request failed");
    const data = await response.json();
    const hero = document.querySelector("#top");
    hero.className = `hero ${data.overall}`;
    hero.querySelector(".status-icon").innerHTML = statusIcons[data.overall];
    document.querySelector("#overall-title").textContent = overallCopy[data.overall];
    document.querySelector("#overall-copy").textContent = "Trackster products are checked automatically every minute.";
    document.querySelector("#last-checked").textContent = `Checked ${formatTime(data.checkedAt)}`;
    renderServices(data.services);
    renderIncidents(data.incidents);
  } catch {
    document.querySelector("#overall-title").textContent = "Status check unavailable";
    document.querySelector("#overall-copy").textContent = "The dashboard couldn’t refresh. Please try again shortly.";
  } finally {
    refresh.classList.remove("spin");
  }
}

document.querySelector("#refresh").addEventListener("click", () => loadStatus(true));
loadStatus();
setInterval(loadStatus, 60_000);
