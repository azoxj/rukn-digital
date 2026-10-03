// node:sqlite DatabaseSync API on top of sql.js (SQLite compiled to WebAssembly).
// globalThis.__SQLJS must be initialised before the first database is opened.
const clean = (args) => args.map((a) => (a === undefined ? null : typeof a === "boolean" ? (a ? 1 : 0) : a));

export class DatabaseSync {
  constructor() {
    if (!globalThis.__SQLJS) throw new Error("sql.js is not initialised");
    this.db = new globalThis.__SQLJS.Database();
    this.isTransaction = false;
  }
  exec(sql) {
    const s = sql.trim().toUpperCase();
    this.db.exec(sql);
    if (s.startsWith("BEGIN")) this.isTransaction = true;
    else if (s.startsWith("COMMIT") || s.startsWith("ROLLBACK")) this.isTransaction = false;
  }
  prepare(sql) {
    const db = this.db;
    const stmt = () => db.prepare(sql);
    return {
      get(...args) {
        const st = stmt();
        try { st.bind(clean(args)); return st.step() ? st.getAsObject() : undefined; } finally { st.free(); }
      },
      all(...args) {
        const st = stmt(), rows = [];
        try { st.bind(clean(args)); while (st.step()) rows.push(st.getAsObject()); return rows; } finally { st.free(); }
      },
      run(...args) {
        const st = stmt();
        try { st.bind(clean(args)); st.step(); } finally { st.free(); }
        const changes = db.getRowsModified();
        const id = db.exec("SELECT last_insert_rowid() AS id")[0].values[0][0];
        return { changes, lastInsertRowid: id };
      },
    };
  }
  close() { this.db.close(); }
}
export default { DatabaseSync };
