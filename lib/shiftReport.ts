/**
 * Professional shift-handoff report → print-ready PDF.
 *
 * Builds a fully branded HTML document (ReHub identity, critical section,
 * analytics, per-patient rundown, AI narrative) and opens it in a print window.
 * The user's "Save as PDF" produces a polished, board-quality document — no
 * extra libraries, works entirely client-side.
 */

import { URGENCY_META, type Request, type UrgencyLevel } from "@/lib/types";

const ORDER: UrgencyLevel[] = ["Critical", "High", "Medium", "Low", "Informational"];

function urgencyOf(r: Request): UrgencyLevel {
  return r.urgencyLevel ?? (r.priority === "Urgent" ? "High" : r.priority === "Important" ? "Medium" : "Low");
}

function minsBetween(a?: string | null, b?: string | null): number | null {
  if (!a) return null;
  const start = new Date(a).getTime();
  const end = b ? new Date(b).getTime() : Date.now();
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  return Math.max(0, Math.round((end - start) / 60000));
}

function fmtMins(m: number | null): string {
  if (m == null) return "—";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
}

export function openShiftReportPdf(facilityName: string, requests: Request[], aiNarrative: string) {
  const now = new Date();
  const generated = now.toLocaleString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

  // ── Analytics (computed locally — free) ──────────────────────────────────
  const total = requests.length;
  const byU: Record<string, number> = {};
  const byType: Record<string, number> = {};
  const byRoom: Record<string, number> = {};
  let open = 0, resolved = 0, respSum = 0, respN = 0;

  const enriched = requests.map((r) => {
    const u = urgencyOf(r);
    byU[u] = (byU[u] ?? 0) + 1;
    byType[r.requestType] = (byType[r.requestType] ?? 0) + 1;
    byRoom[r.roomNumber] = (byRoom[r.roomNumber] ?? 0) + 1;
    const acked = r.status === "Acknowledged" || r.status === "In Progress" || r.status === "Resolved";
    if (r.status === "Resolved") resolved++;
    if (!acked) open++;
    const responseM = typeof r.responseTimeMinutes === "number" ? r.responseTimeMinutes : minsBetween(r.createdAt, r.acknowledgedAt);
    if (acked && responseM != null) { respSum += responseM; respN++; }
    const waitM = acked ? responseM : minsBetween(r.createdAt, null);
    return { r, u, acked, responseM, waitM };
  });

  const avgResp = respN ? Math.round((respSum / respN) * 10) / 10 : null;
  const busiest = Object.entries(byRoom).sort((a, b) => b[1] - a[1])[0];
  const topType = Object.entries(byType).sort((a, b) => b[1] - a[1])[0];
  const criticalRows = enriched.filter((e) => e.u === "Critical" || e.u === "High")
    .sort((a, b) => ORDER.indexOf(a.u) - ORDER.indexOf(b.u));

  const sortedAll = [...enriched].sort((a, b) => ORDER.indexOf(a.u) - ORDER.indexOf(b.u));

  // ── KPI cards ────────────────────────────────────────────────────────────
  const kpis = [
    { n: String(total), l: "Total requests" },
    { n: String(open), l: "Open right now", warn: open > 0 },
    { n: avgResp != null ? `${avgResp}m` : "—", l: "Avg response time" },
    { n: String(byU["Critical"] ?? 0), l: "Critical events", crit: (byU["Critical"] ?? 0) > 0 },
  ];

  const kpiHtml = kpis.map((k) => `
    <div class="kpi ${k.crit ? "kpi-crit" : k.warn ? "kpi-warn" : ""}">
      <div class="kpi-n">${esc(k.n)}</div>
      <div class="kpi-l">${esc(k.l)}</div>
    </div>`).join("");

  // ── Priority bars ─────────────────────────────────────────────────────────
  const barsHtml = ORDER.map((lvl) => {
    const n = byU[lvl] ?? 0;
    const pct = total ? Math.round((n / total) * 100) : 0;
    const m = URGENCY_META[lvl];
    return `<div class="bar-row">
      <span class="bar-lbl">${esc(m.label)}</span>
      <span class="bar-track"><span class="bar-fill" style="width:${pct}%;background:${m.color}"></span></span>
      <span class="bar-n">${n}</span>
    </div>`;
  }).join("");

  // ── Critical section ──────────────────────────────────────────────────────
  const critHtml = criticalRows.length ? criticalRows.map((e) => {
    const m = URGENCY_META[e.u];
    return `<div class="crit-card" style="border-left-color:${m.color}">
      <div class="crit-top">
        <span class="crit-room">Room ${esc(e.r.roomNumber)}</span>
        <span class="crit-name">${esc(e.r.residentName)}</span>
        <span class="crit-badge" style="color:${m.color};background:${m.bg}">${esc(m.label)}</span>
      </div>
      <div class="crit-msg">${esc(e.r.transcript || e.r.aiSummary || e.r.requestType)}</div>
      <div class="crit-meta">${e.acked ? `Responded in ${fmtMins(e.responseM)}` : `Waiting ${fmtMins(e.waitM)}`}${e.r.acknowledgedBy ? ` · ${esc(e.r.acknowledgedBy)}` : ""} · ${esc(e.r.status)}</div>
    </div>`;
  }).join("") : `<div class="empty">No critical or high-priority events this shift. ✓</div>`;

  // ── Full rundown table ────────────────────────────────────────────────────
  const rowsHtml = sortedAll.map((e) => {
    const m = URGENCY_META[e.u];
    return `<tr>
      <td><b>${esc(e.r.roomNumber)}</b></td>
      <td>${esc(e.r.residentName)}</td>
      <td class="msg">${esc(e.r.transcript || e.r.aiSummary || e.r.requestType)}</td>
      <td><span class="dot" style="background:${m.color}"></span>${esc(m.label)}</td>
      <td>${e.acked ? fmtMins(e.responseM) : `<span class="wait">${fmtMins(e.waitM)}</span>`}</td>
      <td>${esc(e.r.status)}</td>
      <td>${esc(e.r.acknowledgedBy ?? "—")}</td>
    </tr>`;
  }).join("");

  const narrativeHtml = esc(aiNarrative).replace(/\n/g, "<br>");

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>ReHub Shift Report — ${esc(facilityName)}</title>
<style>
  :root{--navy:#102a43;--teal:#2f9e9e;--mint:#d9f0e5;--offwhite:#f7f4ef;--slate:#334e68;--muted:#d9e2ec;--coral:#d95d4f;--amber:#f0b429;--success:#2f855a;--soft:#62748a;}
  *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  body{margin:0;font-family:-apple-system,"SF Pro Display","Helvetica Neue",Arial,sans-serif;color:#1c2b3a;font-size:11pt;line-height:1.5;}
  @page{size:Letter;margin:0.5in 0.55in;}
  .wrap{max-width:7.4in;margin:0 auto;}
  .head{background:var(--navy);color:#fff;border-radius:14px;padding:18px 22px;display:flex;align-items:center;justify-content:space-between;}
  .mark{display:flex;align-items:center;gap:10px;}
  .glyph{width:30px;height:30px;border-radius:8px;background:#fff;display:flex;align-items:center;justify-content:center;}
  .wm{font-size:15pt;font-weight:800;letter-spacing:-0.02em;}.wm b{color:#7fd6d6;}
  .head .ttl{font-size:9pt;color:#9fb6cc;text-align:right;}
  .head .ttl b{display:block;color:#fff;font-size:12pt;letter-spacing:0.01em;}
  h2.sec{font-size:13pt;color:var(--navy);margin:26px 0 12px;display:flex;align-items:center;gap:8px;}
  h2.sec::before{content:"";width:4px;height:16px;border-radius:2px;background:var(--teal);}
  h2.sec.crit::before{background:var(--coral);}
  .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:18px;}
  .kpi{border:1px solid var(--muted);border-radius:12px;padding:14px 14px;background:var(--offwhite);}
  .kpi-n{font-size:23pt;font-weight:800;color:var(--navy);line-height:1;letter-spacing:-0.02em;}
  .kpi-l{font-size:8.6pt;color:var(--slate);margin-top:6px;}
  .kpi-warn{background:#fdf8ec;border-color:#f1e2b8;} .kpi-warn .kpi-n{color:#9a6a00;}
  .kpi-crit{background:#fdf3f1;border-color:#f3cfca;} .kpi-crit .kpi-n{color:var(--coral);}
  .cols{display:grid;grid-template-columns:1.1fr 0.9fr;gap:20px;align-items:start;}
  .crit-card{border:1px solid var(--muted);border-left-width:4px;border-radius:10px;padding:11px 13px;margin-bottom:9px;background:#fff;}
  .crit-top{display:flex;align-items:center;gap:8px;}
  .crit-room{font-weight:800;color:var(--navy);font-size:10.5pt;}
  .crit-name{color:var(--slate);font-size:9.5pt;}
  .crit-badge{margin-left:auto;font-size:7.6pt;font-weight:800;padding:2px 8px;border-radius:999px;}
  .crit-msg{font-size:10pt;color:#1c2b3a;margin-top:5px;}
  .crit-meta{font-size:8.4pt;color:var(--soft);margin-top:5px;}
  .empty{padding:16px;border:1px dashed var(--muted);border-radius:10px;color:var(--success);font-weight:600;font-size:10pt;background:#f1faf4;}
  .panel{border:1px solid var(--muted);border-radius:12px;padding:15px 16px;}
  .bar-row{display:flex;align-items:center;gap:9px;margin-bottom:9px;}
  .bar-lbl{width:78px;font-size:8.8pt;color:var(--slate);font-weight:600;}
  .bar-track{flex:1;height:8px;border-radius:5px;background:var(--offwhite);overflow:hidden;}
  .bar-fill{display:block;height:100%;border-radius:5px;}
  .bar-n{width:22px;text-align:right;font-size:8.8pt;font-weight:700;color:var(--soft);}
  .meta-list{margin-top:14px;border-top:1px solid var(--muted);padding-top:12px;font-size:9pt;color:var(--slate);}
  .meta-list div{display:flex;justify-content:space-between;margin-bottom:6px;}
  .meta-list b{color:var(--navy);}
  table.run{width:100%;border-collapse:collapse;font-size:8.8pt;margin-top:4px;}
  table.run th{text-align:left;font-size:7.4pt;text-transform:uppercase;letter-spacing:0.06em;color:var(--soft);padding:7px 8px;border-bottom:2px solid var(--muted);}
  table.run td{padding:7px 8px;border-bottom:1px solid var(--muted);vertical-align:top;color:var(--slate);}
  table.run td.msg{color:#1c2b3a;max-width:2in;}
  table.run .dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:5px;vertical-align:middle;}
  table.run .wait{color:var(--coral);font-weight:700;}
  .narr{border-left:4px solid var(--teal);background:var(--mint);border-radius:0 12px 12px 0;padding:14px 18px;font-size:10pt;color:#1c2b3a;line-height:1.6;}
  .foot{margin-top:26px;border-top:1px solid var(--muted);padding-top:10px;font-size:7.6pt;color:#9fb0c0;display:flex;justify-content:space-between;}
  @media print{.noprint{display:none!important;}}
  .noprint{position:fixed;top:14px;right:14px;display:flex;gap:8px;}
  .btn{font-family:inherit;font-size:11pt;font-weight:700;border:none;border-radius:10px;padding:10px 18px;cursor:pointer;}
  .btn-p{background:var(--navy);color:#fff;} .btn-s{background:#fff;color:var(--navy);border:1px solid var(--muted);}
</style></head>
<body>
  <div class="noprint">
    <button class="btn btn-p" onclick="window.print()">Save as PDF</button>
    <button class="btn btn-s" onclick="window.close()">Close</button>
  </div>
  <div class="wrap">
    <div class="head">
      <div class="mark">
        <span class="glyph"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#2f9e9e" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h4l2 6 4-14 2 8h6"/></svg></span>
        <span class="wm">Re<b>Hub</b></span>
      </div>
      <div class="ttl"><b>Shift Handoff Report</b>${esc(facilityName)} · ${esc(generated)}</div>
    </div>

    <div class="kpis">${kpiHtml}</div>

    <h2 class="sec crit">Critical &amp; high-priority events</h2>
    ${critHtml}

    <div class="cols">
      <div>
        <h2 class="sec">Priority distribution</h2>
        <div class="panel">${barsHtml}</div>
      </div>
      <div>
        <h2 class="sec">Shift at a glance</h2>
        <div class="panel meta-list" style="margin-top:0;border-top:none;padding-top:15px;">
          <div><span>Resolved</span><b>${resolved} / ${total}</b></div>
          <div><span>Still open</span><b>${open}</b></div>
          <div><span>Avg response</span><b>${avgResp != null ? avgResp + " min" : "—"}</b></div>
          <div><span>Busiest room</span><b>${busiest ? "Room " + esc(busiest[0]) + " (" + busiest[1] + ")" : "—"}</b></div>
          <div><span>Most common</span><b>${topType ? esc(topType[0]) + " (" + topType[1] + ")" : "—"}</b></div>
        </div>
      </div>
    </div>

    <h2 class="sec">Hubi shift narrative</h2>
    <div class="narr">${narrativeHtml || "No narrative available."}</div>

    <h2 class="sec">Full request rundown</h2>
    <table class="run">
      <thead><tr><th>Room</th><th>Patient</th><th>Request</th><th>Priority</th><th>Response / wait</th><th>Status</th><th>Handled by</th></tr></thead>
      <tbody>${rowsHtml || `<tr><td colspan="7" style="text-align:center;color:var(--soft);padding:16px;">No requests this shift.</td></tr>`}</tbody>
    </table>

    <div class="foot">
      <span>ReHub · Confidential — contains patient request information. Generated ${esc(generated)}.</span>
      <span>Hubi · AI care coordination</span>
    </div>
  </div>
  <script>window.addEventListener('load',function(){setTimeout(function(){window.print();},350);});</script>
</body></html>`;

  const win = window.open("", "_blank", "width=900,height=1100");
  if (!win) return false;
  win.document.open();
  win.document.write(html);
  win.document.close();
  return true;
}
