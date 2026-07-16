import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

const configuredConnectionString = process.env.DATABASE_URL?.trim();

if (!configuredConnectionString) {
  throw new Error(
    "DATABASE_URL is required. Copy .env.example to .env.local and add the pooled Neon connection string.",
  );
}

const connectionUrl = new URL(configuredConnectionString);
const sslMode = connectionUrl.searchParams.get("sslmode");
if (["prefer", "require", "verify-ca"].includes(sslMode ?? "")) {
  connectionUrl.searchParams.set("sslmode", "verify-full");
}
const connectionString = connectionUrl.toString();

const migrationsDirectory = fileURLToPath(
  new URL("../neon/migrations/", import.meta.url),
);
const migrationFiles = (await readdir(migrationsDirectory))
  .filter((file) => file.endsWith(".sql"))
  .sort();

if (migrationFiles.length === 0) {
  throw new Error("No SQL migrations were found in neon/migrations.");
}

const client = new Client({ connectionString });

try {
  await client.connect();
  await client.query(`
    create schema if not exists movie_tracker_internal;
    revoke all on schema movie_tracker_internal from public;
    create table if not exists movie_tracker_internal.schema_migrations (
      filename text primary key,
      checksum text not null,
      applied_at timestamptz not null default now()
    );
  `);

  for (const filename of migrationFiles) {
    const sql = await readFile(
      new URL(`../neon/migrations/${filename}`, import.meta.url),
      "utf8",
    );
    const checksum = createHash("sha256").update(sql).digest("hex");
    const existing = await client.query(
      "select checksum from movie_tracker_internal.schema_migrations where filename = $1",
      [filename],
    );

    if (existing.rowCount) {
      if (existing.rows[0].checksum !== checksum) {
        throw new Error(
          `Applied migration ${filename} has changed. Add a new migration instead of editing migration history.`,
        );
      }
      console.log(`Already applied: ${filename}`);
      continue;
    }

    await client.query("begin");
    try {
      await client.query(sql);
      await client.query(
        "insert into movie_tracker_internal.schema_migrations (filename, checksum) values ($1, $2)",
        [filename, checksum],
      );
      await client.query("commit");
      console.log(`Applied: ${filename}`);
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  }
} finally {
  await client.end();
}
