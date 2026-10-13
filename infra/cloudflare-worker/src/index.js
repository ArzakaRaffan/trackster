// Cloudflare Email Worker `trackster-inbound` (P7-03): rule `u@in.trackster.dev` (alamat user u+<kode>, subaddressing) -> POST /ingest/email.
// Body = MIME mentah; tanda tangan HMAC-SHA256(secret, `${tsMs}.${to}.${sha256hex(body)}`) — sama dengan
// apps/backend/src/modules/inbound/inbound.util.ts (signBody). Tanpa rahasia di repo: `wrangler secret put INGEST_HMAC_SECRET`.
// Dok runtime: https://developers.cloudflare.com/email-routing/email-workers/runtime-api/ (dibaca 2026-10-13).
const MAX_BYTES = 3 * 1024 * 1024; // sama dengan batas backend

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

async function sign(secret, ts, to, body) {
  const bodyHash = hex(await crypto.subtle.digest('SHA-256', body));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${ts}.${to}.${bodyHash}`)));
}

export default {
  async email(message, env) {
    // Terlalu besar = pasti bukan notifikasi bank. Dibuang diam-diam (setReject akan memantul ke Gmail pengirim).
    if (message.rawSize > MAX_BYTES) return;
    const body = await new Response(message.raw).arrayBuffer();
    const to = message.to.toLowerCase();

    let lastError = '';
    for (let attempt = 0; attempt < 3; attempt++) {
      const ts = String(Date.now()); // ditandatangani ulang tiap percobaan (backend menolak timestamp > 5 menit)
      try {
        const res = await fetch(env.INGEST_URL, {
          method: 'POST',
          headers: {
            'content-type': 'message/rfc822',
            'x-trackster-to': to,
            'x-trackster-timestamp': ts,
            'x-trackster-signature': await sign(env.INGEST_HMAC_SECRET, ts, to, body),
          },
          body,
        });
        if (res.ok) return;
        lastError = `HTTP ${res.status}`;
        if (res.status >= 400 && res.status < 500) break; // 4xx (tanda tangan/ukuran) tidak akan sembuh dengan retry
      } catch (e) {
        lastError = String(e);
      }
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
    }
    console.error(`ingest gagal untuk ${to}: ${lastError}`);
    // Dead-letter: email tidak hilang; bisa diputar ulang (dedup by Message-ID di backend). Harus alamat terverifikasi di Email Routing.
    if (env.DEAD_LETTER && message.canBeForwarded) await message.forward(env.DEAD_LETTER);
  },
};
