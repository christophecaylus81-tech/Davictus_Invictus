import { readFile } from "node:fs/promises";
import path from "node:path";
import { pool } from "./pool";

async function runMigration(): Promise<void> {
  const schemaPath = path.join(process.cwd(), "src", "infra", "db", "schema.sql");
  const sql = await readFile(schemaPath, "utf-8");
  await pool.query(sql);
  console.log("Migration appliquée avec succès.");
}

runMigration()
  .catch((error) => {
    console.error("Erreur pendant la migration:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
