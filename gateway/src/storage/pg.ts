import { Pool } from "pg";

export function createPgPool(): Pool {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10
  });

  return pool;
}

