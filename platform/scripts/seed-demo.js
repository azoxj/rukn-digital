// Fill an EMPTY database with clearly fictional demo data for trying the app.
//   npm run seed:demo -- --app callcenter
// All demo accounts share one password: DEMO_PASSWORD, or a generated one printed once.
import { openDb, migrate, tx } from "../core/db.js";
import { hashPassword, generatePassword, passwordProblem } from "../core/security.js";
import { args, loadApp, dbFileFor } from "./lib.js";

const a = args();
const app = await loadApp(a.app);
const { seedDemo } = await import(`../apps/${app.name}/seed.js`);
const db = openDb(dbFileFor(app.name));
migrate(db, app.name, app.migrationsDir);
if (db.prepare("SELECT COUNT(*) AS n FROM users").get().n > 0) { console.error("Refusing: the database is not empty. Use a new DB_FILE for demo data."); process.exit(1); }
const password = process.env.DEMO_PASSWORD || generatePassword();
const problem = passwordProblem(password);
if (problem) { console.error("DEMO_PASSWORD: " + problem); process.exit(1); }
const hash = await hashPassword(password);
const accounts = tx(db, () => seedDemo(db, hash));
db.close();
console.log(`Seeded demo data for ${app.title} into ${dbFileFor(app.name)}`);
console.table(accounts.map(([role, email]) => ({ role, email })));
if (!process.env.DEMO_PASSWORD) console.log(`Demo password for all accounts (shown once): ${password}`);
