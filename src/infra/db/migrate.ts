import { readFile } from "node:fs/promises";
import path from "node:path";
import { pool } from "./pool";

const MAX_ATTEMPTS = 10;
const RETRY_DELAY_MS = 3000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runMigration(): Promise<void> {
  const schemaPath = path.join(process.cwd(), "src", "infra", "db", "schema.sql");
  const sql = await readFile(schemaPath, "utf-8");

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      await pool.query(sql);
      console.log("Migration appliquée avec succès.");
      return;
    } catch (error) {
      if (attempt === MAX_ATTEMPTS) {
        throw error;
      }
      console.warn(
        `Migration: tentative ${attempt}/${MAX_ATTEMPTS} échouée, nouvelle tentative dans ${RETRY_DELAY_MS} ms...`
      );
      await sleep(RETRY_DELAY_MS);
    }
  }
}

runMigration()
  .catch((error) => {
    console.error("Erreur pendant la migration:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
