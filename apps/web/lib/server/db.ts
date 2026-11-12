import postgres from "postgres";

/**
 * One Postgres connection per server instance (Neon in production, any Postgres locally).
 * The schema is created on first use: two tables are not worth a migration tool yet.
 * Without DATABASE_URL the app still runs — the API answers 503 and the client shows
 * nothing saved — so a static or demo build never needs a database.
 */
let sql: ReturnType<typeof postgres> | null = null;
let ready: Promise<void> | null = null;

/** Vercel's Neon integration names the variable differently depending on how it was added. */
export function databaseUrl() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || "";
}

export function hasDatabase() {
  return !!databaseUrl();
}

export function db() {
  if (!sql) {
    const url = databaseUrl();
    if (!url) throw new Error("DATABASE_URL is not set");
    // Neon closes idle connections itself; keep the pool small for serverless functions.
    sql = postgres(url, { max: 3, idle_timeout: 20, connect_timeout: 10, prepare: false });
  }
  return sql;
}

export async function ensureSchema() {
  if (!ready) {
    ready = (async () => {
      const q = db();
      await q`create table if not exists indices (
        id text primary key,
        owner text not null,
        name text not null,
        picks jsonb not null,
        weights jsonb not null,
        units jsonb not null default '{}'::jsonb,
        cost_usd numeric not null default 0,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )`;
      await q`create index if not exists indices_owner on indices (owner)`;
      await q`create table if not exists purchases (
        tx text primary key,
        owner text not null,
        index_id text not null references indices (id),
        kind text not null,
        usd numeric not null,
        units jsonb not null,
        at timestamptz not null default now()
      )`;
      await q`create index if not exists purchases_owner on purchases (owner)`;
    })().catch((e) => { ready = null; throw e; });
  }
  return ready;
}
