const healthLabels = { operational: "Healthy", degraded: "Degraded", outage: "Outage", unknown: "No data" };

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[character]);
}

function formatDay(value) {
  return new Intl.DateTimeFormat("en", {
    weekday: "long", month: "short", day: "numeric", year: "numeric", timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function description(status) {
  if (status === "operational") return "All recorded checks passed";
  if (status === "degraded") return "At least one slow check was recorded";
  if (status === "outage") return "At least one failed check was recorded";
  return "Monitoring data is not available for this day";
}

function last30Days(service) {
  const stored = new Map((service.history || []).map((item) => [item.day, item.status]));
  return Array.from({ length: 30 }, (_, index) => {
    const day = new Date(Date.now() - (29 - index) * 86_400_000).toISOString().slice(0, 10);
    return { day, status: stored.get(day) || (index === 29 ? service.status : "unknown") };
  });
}

function render(service) {
  const days = last30Days(service);
  const monitored = days.filter((day) => day.status !== "unknown");
  const healthy = monitored.length
    ? monitored.filter((day) => day.status === "operational").length / monitored.length * 100
    : null;
  document.querySelector("#uptime-service-name").textContent = service.name;
  document.querySelector("#uptime-percentage").textContent = healthy === null ? "—" : `${healthy.toFixed(2)}%`;
  document.querySelector("#days-monitored").textContent = `${monitored.length} / 30`;
  const current = document.querySelector("#current-health");
  current.textContent = healthLabels[service.status];
  current.className = service.status;
  document.querySelector("#calendar-grid").innerHTML = days.map((day) => {
    const detail = `${formatDay(day.day)} · ${healthLabels[day.status]} · ${description(day.status)}`;
    const date = new Date(`${day.day}T00:00:00Z`);
    return `<div class="calendar-day ${day.status}" aria-label="${escapeHtml(detail)}" data-status="${day.status}" data-tooltip="${escapeHtml(detail)}">
      <span>${new Intl.DateTimeFormat("en", { weekday: "short", timeZone: "UTC" }).format(date)}</span>
      <strong>${date.getUTCDate()}</strong>
    </div>`;
  }).join("");
}

const tooltip = document.createElement("div");
tooltip.className = "check-tooltip";
tooltip.setAttribute("role", "tooltip");
document.body.append(tooltip);

document.addEventListener("pointerover", (event) => {
  const day = event.target.closest?.("[data-tooltip]");
  if (!day) return;
  tooltip.textContent = day.dataset.tooltip;
  tooltip.dataset.status = day.dataset.status;
  tooltip.classList.add("visible");
  const rect = day.getBoundingClientRect();
  const half = tooltip.offsetWidth / 2;
  const left = Math.min(window.innerWidth - half - 10, Math.max(half + 10, rect.left + rect.width / 2));
  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${rect.top - 9}px`;
});

document.addEventListener("pointerout", (event) => {
  const day = event.target.closest?.("[data-tooltip]");
  if (day && !day.contains(event.relatedTarget)) tooltip.classList.remove("visible");
});

async function load() {
  const response = await fetch("/api/status", { cache: "no-store" });
  if (!response.ok) throw new Error("Status request failed");
  const data = await response.json();
  const select = document.querySelector("#service-select");
  select.innerHTML = data.services.map((service) => `<option value="${escapeHtml(service.id)}">${escapeHtml(service.name)}</option>`).join("");
  const requested = new URLSearchParams(location.search).get("service");
  const selected = data.services.find((service) => service.id === requested) || data.services[0];
  select.value = selected.id;
  render(selected);
  select.addEventListener("change", () => {
    const service = data.services.find((item) => item.id === select.value);
    if (!service) return;
    history.replaceState(null, "", `/uptime?service=${encodeURIComponent(service.id)}`);
    render(service);
  });
}

load().catch(() => {
  document.querySelector("#uptime-service-name").textContent = "Uptime data unavailable";
});
