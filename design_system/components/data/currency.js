/** Rupiah formatting shared by the data components. */
export function formatIDR(value, { compact = false, sign = false } = {}) {
  const n = Number(value) || 0;
  const abs = Math.abs(n);
  let body;
  if (compact && abs >= 1000000) body = trim(abs / 1000000) + "jt";
  else if (compact && abs >= 1000) body = trim(abs / 1000) + "rb";
  else body = abs.toLocaleString("id-ID");
  const prefix = sign ? (n < 0 ? "−" : "+") : n < 0 ? "−" : "";
  return prefix + "Rp" + body;
}
function trim(x) {
  return (Math.round(x * 10) / 10).toString().replace(".", ",");
}
/** Clock time from an ISO timestamp, e.g. "19:42". */
export function formatTime(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return "";
  return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}
