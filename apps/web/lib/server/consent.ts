import { db, ensureSchema } from "./db.ts";

/**
 * The declaration a person makes before their first purchase: not a US person, read the
 * disclosures. Versioned, so a changed text asks again. Stored with the country the edge
 * saw, which is the evidence the declaration was not made from a blocked place.
 */
export const CONSENT_VERSION = 1;

export async function ensureConsents() {
  await ensureSchema();
  await db()`create table if not exists consents (
    owner text not null,
    version int not null,
    country text,
    at timestamptz not null default now(),
    primary key (owner, version)
  )`;
}

export async function hasConsent(owner: string) {
  await ensureConsents();
  const r = await db()`select 1 from consents where owner = ${owner.toLowerCase()} and version = ${CONSENT_VERSION}`;
  return r.length > 0;
}

export async function recordConsent(owner: string, country: string | null) {
  await ensureConsents();
  await db()`insert into consents (owner, version, country) values (${owner.toLowerCase()}, ${CONSENT_VERSION}, ${country})
    on conflict (owner, version) do nothing`;
}
