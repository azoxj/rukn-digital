// Audit log + notifications + small query helpers shared by apps.
export function createAudit(db) {
  const ins = db.prepare(`INSERT INTO audit_log (org_id, user_id, action, entity, entity_id, meta, ip) VALUES (?,?,?,?,?,?,?)`);
  return {
    /** who: a request ctx (uses ctx.user / ctx.ip) or { org_id, user_id, ip }. */
    log(who, action, entity = null, entityId = null, meta = null) {
      const orgId = who.user ? who.user.org_id : who.org_id ?? null;
      const userId = who.user ? who.user.id : who.user_id ?? null;
      ins.run(orgId, userId, action, entity, entityId == null ? null : String(entityId), meta ? JSON.stringify(meta) : null, who.ip || null);
    },
  };
}

export function createNotifier(db) {
  const ins = db.prepare(`INSERT INTO notifications (org_id, user_id, type, title, body, link) VALUES (?,?,?,?,?,?)`);
  const sameOrg = db.prepare(`SELECT 1 FROM users WHERE id = ? AND org_id = ? AND is_active = 1`);
  return {
    /** Notify a user of the same organisation (silently ignores others / self when skipSelf). */
    send(orgId, userId, { type, title, body = null, link = null }, { skipUserId } = {}) {
      if (!userId || userId === skipUserId) return;
      if (!sameOrg.get(userId, orgId)) return;
      ins.run(orgId, userId, type, String(title).slice(0, 200), body ? String(body).slice(0, 500) : null, link);
    },
  };
}

/** Pagination from query (?page=&size=), bounded. */
export function paging(query, def = 25, max = 100) {
  const size = Math.min(max, Math.max(1, parseInt(query.size, 10) || def));
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  return { size, page, offset: (page - 1) * size };
}

/** Escape LIKE wildcards; used with ESCAPE '\\'. */
export const likeTerm = (s) => `%${String(s).replace(/[\\%_]/g, (c) => "\\" + c)}%`;

/** Build "a = ?, b = ?" for a PATCH with only provided columns. */
export function updateSet(fields, allowed) {
  const cols = Object.keys(fields).filter((k) => allowed.includes(k));
  return { sql: cols.map((c) => `${c} = ?`).join(", "), values: cols.map((c) => fields[c]), cols };
}

/** CSV with BOM so Excel opens Arabic correctly; neutralises formula injection. */
export function toCsv(headers, rows) {
  const cell = (x) => {
    let s = x == null ? "" : String(x);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + [headers.map(cell).join(","), ...rows.map((r) => r.map(cell).join(","))].join("\r\n");
}

export function sendCsv(res, name, csv) {
  res.writeHead(200, {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${name}"`,
    "Cache-Control": "no-store",
  });
  res.end(csv);
}
