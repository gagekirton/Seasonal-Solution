// Demo-deploy helper: when DATABASE_URL points at a hosted MySQL/TiDB
// server, make sure the named database exists before migrations run
// (drizzle-kit connects straight to the named database and fails if it is
// missing). Connects without selecting a database, issues
// CREATE DATABASE IF NOT EXISTS, and retries for a while so a scale-to-zero
// serverless instance has time to wake up.
const mysql = require("mysql2/promise");

async function main() {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    console.log("[ensure-database] DATABASE_URL is not set; nothing to do.");
    return;
  }
  const url = new URL(raw);
  const dbName = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!/^[A-Za-z0-9_]+$/.test(dbName)) {
    throw new Error(`[ensure-database] Refusing unsafe database name: ${dbName}`);
  }
  let ssl;
  const sslParam = url.searchParams.get("ssl");
  if (sslParam) {
    try {
      ssl = JSON.parse(sslParam);
    } catch {
      ssl = undefined;
    }
  }
  const config = {
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    ssl,
    connectTimeout: 15000,
  };
  const attempts = 12;
  for (let i = 1; i <= attempts; i++) {
    try {
      const conn = await mysql.createConnection(config);
      await conn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
      await conn.end();
      console.log(`[ensure-database] Database '${dbName}' is ready.`);
      return;
    } catch (error) {
      console.log(
        `[ensure-database] Attempt ${i}/${attempts} failed: ${error.code || error.message}`
      );
      if (i === attempts) throw error;
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

main().catch(error => {
  console.error("[ensure-database] Giving up:", error.message);
  process.exit(1);
});
