import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = `${__dirname}/../data/demo.sqlite`;

// Columns the (fictitious) app code actually reads. Anything on the
// `users` table not in this list counts as "unused" for inspectSchema().
const COLUMNS_IN_USE = new Set([
  'id',
  'email',
  'name',
  'created_at',
  'last_login_at',
]);

// legacy_phone is seeded with real data on every row so the irreversible
// branch fires every time. fax_number and referral_code_v1 are seeded
// empty so they're always safe to drop outright. Deterministic on
// every server boot -- same demo in every rehearsal.
const TOTAL_USERS = 12_400;

let db: DatabaseSync | undefined;

export function initDb(): DatabaseSync {
  mkdirSync(`${__dirname}/../data`, { recursive: true });
  db?.close();
  db = new DatabaseSync(DB_PATH);

  db.exec('DROP TABLE IF EXISTS users');
  db.exec('DROP TABLE IF EXISTS users_archive');
  db.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY,
      email TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      last_login_at TEXT,
      legacy_phone TEXT,
      fax_number TEXT,
      referral_code_v1 TEXT
    )
  `);

  const insert = db.prepare(`
    INSERT INTO users (id, email, name, created_at, last_login_at, legacy_phone, fax_number, referral_code_v1)
    VALUES (?, ?, ?, ?, ?, ?, NULL, NULL)
  `);

  db.exec('BEGIN');
  for (let i = 1; i <= TOTAL_USERS; i++) {
    const areaCode = 200 + (i % 800);
    const phone = `+1${areaCode}555${String(i).padStart(4, '0')}`;
    insert.run(
      i,
      `user${i}@example.com`,
      `Demo User ${i}`,
      '2019-01-01T00:00:00.000Z',
      i % 3 === 0 ? '2024-11-01T00:00:00.000Z' : null,
      phone,
    );
  }
  db.exec('COMMIT');

  return db;
}

export function getDb(): DatabaseSync {
  if (!db) throw new Error('DB not initialized -- call initDb() first');
  return db;
}

export interface ColumnStat {
  name: string;
  populatedRows: number;
}

/** Deterministic "schema inspection" the agent's inspectSchema tool calls. */
export function inspectUnusedColumns(): ColumnStat[] {
  const table = getDb().prepare(`PRAGMA table_info(users)`).all() as Array<{
    name: string;
  }>;
  const unused = table.map((c) => c.name).filter((name) => !COLUMNS_IN_USE.has(name));

  return unused.map((name) => {
    const row = getDb()
      .prepare(`SELECT COUNT(*) as n FROM users WHERE "${name}" IS NOT NULL`)
      .get() as { n: number };
    return { name, populatedRows: row.n };
  });
}

/** Copies a column's data into an archive table, keyed by user id, then drops it. */
export function archiveAndDropColumn(column: string): { archivedRows: number } {
  const database = getDb();
  database.exec(
    `CREATE TABLE IF NOT EXISTS users_archive (
      user_id INTEGER NOT NULL,
      column_name TEXT NOT NULL,
      value TEXT,
      archived_at TEXT NOT NULL
    )`,
  );
  database.exec('BEGIN');
  const rows = database
    .prepare(`SELECT id, "${column}" as value FROM users WHERE "${column}" IS NOT NULL`)
    .all() as Array<{ id: number; value: string }>;
  const insertArchive = database.prepare(
    `INSERT INTO users_archive (user_id, column_name, value, archived_at) VALUES (?, ?, ?, ?)`,
  );
  const now = new Date().toISOString();
  for (const row of rows) insertArchive.run(row.id, column, row.value, now);
  database.exec(`ALTER TABLE users DROP COLUMN "${column}"`);
  database.exec('COMMIT');
  return { archivedRows: rows.length };
}

export function dropColumn(column: string): void {
  getDb().exec(`ALTER TABLE users DROP COLUMN "${column}"`);
}
