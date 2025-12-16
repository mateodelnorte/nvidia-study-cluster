import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { config } from "../config.js";
import * as schema from "../db/schema.js";
import { createChildLogger } from "./logger.js";

const log = createChildLogger("db");

let sqlite: Database.Database | null = null;
let db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
	if (!db) {
		// Ensure directory exists
		mkdirSync(dirname(config.dbPath), { recursive: true });

		sqlite = new Database(config.dbPath);
		sqlite.pragma("journal_mode = WAL");

		db = drizzle(sqlite, { schema });

		// Run migrations
		log.info("Running database migrations...");
		migrate(db, { migrationsFolder: "./src/db/migrations" });
		log.info("Database migrations complete");
	}
	return db;
}

export function closeDb(): void {
	if (sqlite) {
		sqlite.close();
		sqlite = null;
		db = null;
	}
}
