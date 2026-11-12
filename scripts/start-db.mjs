import EmbeddedPostgres from "embedded-postgres";
import path from "path";
import fs from "fs";

async function main() {
  console.log("Initializing embedded PostgreSQL...");
  const homeDir = process.env.USERPROFILE || process.env.HOME || ".";
  const dataDir = process.env.EMBEDDED_PG_DATA_DIR || path.join(homeDir, ".eoffice-embedded-pg-data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    port: 5432,
    user: "postgres",
    password: "postgres",
    persistent: true,
    initdbFlags: ["-E", "UTF8", "--locale=C"],
  });

  try {
    await pg.initialise();
    console.log("Postgres initialised.");
  } catch (err) {
    console.log("Init warning or already initialised:", err.message);
  }

  await pg.start();
  console.log("Postgres started on port 5432.");

  try {
    await pg.createDatabase("eoffice");
    console.log("Created database eoffice.");
  } catch (err) {
    console.log("DB creation info:", err.message);
  }

  console.log("Ready! PostgreSQL is running.");

  // Keep node process running continuously
  setInterval(() => {}, 1000 * 60 * 60);

  process.on("SIGINT", async () => {
    console.log("Stopping PostgreSQL...");
    try { await pg.stop(); } catch {}
    process.exit(0);
  });
  process.on("SIGTERM", async () => {
    console.log("Stopping PostgreSQL...");
    try { await pg.stop(); } catch {}
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("Error starting embedded Postgres:", err);
  process.exit(1);
});
