import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

let _uiDb: ReturnType<typeof drizzle<typeof schema>> | null = null;
let _uiPool: Pool | null = null;

export function getUiDb() {
  if (!_uiDb) {
    _uiPool = new Pool({
      connectionString: process.env.UI_DATABASE_URL,
      max: 10,
    });
    _uiDb = drizzle(_uiPool, { schema });
  }
  return _uiDb;
}

export function getUiPool(): Pool {
  if (!_uiPool) {
    getUiDb();
  }
  return _uiPool!;
}

export { schema };
