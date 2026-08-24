import pg from "pg";
import { config, validateConfig } from "../config/index.js";

validateConfig();
const { Pool } = pg;

export const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 15000
});

export function db(sql, params = []) {
  return pool.query(sql, params);
}

export async function dbHealth() {
  const started = Date.now();
  await db("select 1");
  return { ok: true, responseMs: Date.now() - started };
}
