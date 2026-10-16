// Local Postgres for development without Docker: PGlite (Postgres compiled to
// WASM) behind a socket, with the Supabase migrations applied. Data persists in
// data/pglite.
//
// Usage: npm run db:local, then use
//   DATABASE_URL=postgres://postgres:postgres@127.0.0.1:54329/postgres

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

const ROOT = join(import.meta.dirname, "..");
const PORT = Number(process.env.PORT ?? 54329);

const db = await PGlite.create(join(ROOT, "data", "pglite"));
await db.exec(`
  create table if not exists local_migrations (name text primary key);
  do $$ begin
    if not exists (select from pg_roles where rolname = 'anon') then create role anon; end if;
    if not exists (select from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
  end $$;
`);

const dir = join(ROOT, "supabase", "migrations");
for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
  const done = await db.query("select 1 from local_migrations where name = $1", [file]);
  if (done.rows.length) continue;
  await db.exec(readFileSync(join(dir, file), "utf8"));
  await db.query("insert into local_migrations (name) values ($1)", [file]);
  console.log(`applied ${file}`);
}

const server = new PGLiteSocketServer({ db, port: PORT, host: "127.0.0.1" });
await server.start();
console.log(`Local Postgres ready: postgres://postgres:postgres@127.0.0.1:${PORT}/postgres`);

const stop = async () => {
  await server.stop();
  await db.close();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
