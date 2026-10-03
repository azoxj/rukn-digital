// Create the first organisation and its top-level account on an EMPTY database.
//   npm run bootstrap -- --app callcenter --org "My Company" --slug my-company --name "Admin Name" --email admin@example.com
// The password comes from BOOTSTRAP_PASSWORD or is generated and printed once.
import { openDb, migrate } from "../core/db.js";
import { hashPassword, generatePassword, passwordProblem } from "../core/security.js";
import { args, loadApp, dbFileFor } from "./lib.js";

const a = args();
const app = await loadApp(a.app);
for (const k of ["org", "slug", "name", "email"]) if (!a[k] || a[k] === true) { console.error(`Missing --${k}`); process.exit(1); }
const db = openDb(dbFileFor(app.name));
migrate(db, app.name, app.migrationsDir);
if (db.prepare("SELECT COUNT(*) AS n FROM users").get().n > 0) { console.error("Refusing: this database already has users."); process.exit(1); }
const password = process.env.BOOTSTRAP_PASSWORD || generatePassword();
const problem = passwordProblem(password);
if (problem) { console.error("BOOTSTRAP_PASSWORD: " + problem); process.exit(1); }
const role = app.roles[0];
const orgId = db.prepare("INSERT INTO organizations (name, slug) VALUES (?, ?)").run(a.org, a.slug).lastInsertRowid;
db.prepare("INSERT INTO users (org_id, email, name, role, password_hash, must_change_password) VALUES (?,?,?,?,?,1)")
  .run(orgId, String(a.email).toLowerCase(), a.name, role, await hashPassword(password));
db.close();
console.log(`Created ${app.title} organisation "${a.org}" and ${role} ${a.email}.`);
if (!process.env.BOOTSTRAP_PASSWORD) console.log(`Temporary password (shown once, must be changed at first sign-in): ${password}`);
