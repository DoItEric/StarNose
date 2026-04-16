import path from "node:path";
import dotenv from "dotenv";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

async function main() {
  const url = process.env.UI_DATABASE_URL;
  if (!url) {
    console.error("UI_DATABASE_URL is not set");
    process.exit(1);
  }

  console.log("Running migrations on starnoseui …");
  const pool = new Pool({ connectionString: url, max: 1 });
  const db = drizzle(pool);

  await migrate(db, {
    migrationsFolder: path.resolve(__dirname, "../../drizzle"),
  });

  console.log("Migrations applied successfully.");
  await pool.end();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
