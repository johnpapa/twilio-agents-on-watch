import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = `${__dirname}/../data/demo.sqlite`;

/** Everyone hit by the (fictitious) outage we're notifying about. */
const TOTAL_AFFECTED = 12_400;

/**
 * Nobody wants a service notification at 3am, and in several places sending
 * one is not merely rude. This is the window the agent refuses to send into
 * without a human saying so: 11pm up to (not including) 7am, local to the
 * person receiving it.
 */
export const QUIET_START_HOUR = 23;
export const QUIET_END_HOUR = 7;

/**
 * Customers are spread evenly across all 24 UTC offsets, which makes the
 * demo both real and stable: the agent genuinely computes each recipient's
 * local time from the clock, and because every offset is represented, the
 * same eight of them are always inside the quiet window. The count moves a
 * little with rounding but never collapses to zero -- so this works at 9am,
 * at midnight, and on stage.
 */
const OFFSETS = Array.from({ length: 24 }, (_, i) => i - 11); // -11 … +12

const ZONE_NAMES: Record<number, string> = {
  [-11]: 'Pacific/Midway', [-10]: 'Pacific/Honolulu', [-9]: 'America/Anchorage',
  [-8]: 'America/Los_Angeles', [-7]: 'America/Denver', [-6]: 'America/Chicago',
  [-5]: 'America/New_York', [-4]: 'America/Halifax', [-3]: 'America/Sao_Paulo',
  [-2]: 'Atlantic/South_Georgia', [-1]: 'Atlantic/Azores', 0: 'Europe/London',
  1: 'Europe/Berlin', 2: 'Africa/Cairo', 3: 'Europe/Moscow', 4: 'Asia/Dubai',
  5: 'Asia/Karachi', 6: 'Asia/Dhaka', 7: 'Asia/Bangkok', 8: 'Asia/Singapore',
  9: 'Asia/Tokyo', 10: 'Australia/Sydney', 11: 'Pacific/Noumea', 12: 'Pacific/Auckland',
};

let db: DatabaseSync | undefined;

export function initDb(): DatabaseSync {
  mkdirSync(`${__dirname}/../data`, { recursive: true });
  db?.close();
  db = new DatabaseSync(DB_PATH);

  db.exec('DROP TABLE IF EXISTS customers');
  db.exec('DROP TABLE IF EXISTS send_log');
  db.exec(`
    CREATE TABLE customers (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      zone TEXT NOT NULL,
      utc_offset INTEGER NOT NULL,
      notified_at TEXT,
      scheduled_for TEXT
    )
  `);
  db.exec(`
    CREATE TABLE send_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch TEXT NOT NULL,
      recipients INTEGER NOT NULL,
      decided_by TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);

  const insert = db.prepare(
    `INSERT INTO customers (id, name, phone, zone, utc_offset) VALUES (?, ?, ?, ?, ?)`,
  );

  db.exec('BEGIN');
  for (let i = 1; i <= TOTAL_AFFECTED; i++) {
    const offset = OFFSETS[i % OFFSETS.length];
    const areaCode = 200 + (i % 800);
    insert.run(
      i,
      `Customer ${i}`,
      `+1${areaCode}555${String(i).padStart(4, '0')}`,
      ZONE_NAMES[offset],
      offset,
    );
  }
  db.exec('COMMIT');

  return db;
}

export function getDb(): DatabaseSync {
  if (!db) throw new Error('DB not initialized -- call initDb() first');
  return db;
}

/** True when `hour` falls in the do-not-disturb window. */
export function isQuietHour(hour: number): boolean {
  return hour >= QUIET_START_HOUR || hour < QUIET_END_HOUR;
}

export interface AudienceSlice {
  /** Everyone the outage affected. */
  total: number;
  /** Recipients whose local time is somewhere reasonable right now. */
  awake: number;
  /** Recipients it is the middle of the night for. */
  asleep: number;
  /** A few example places, for something concrete to say out loud. */
  asleepZones: string[];
  /** Local hour ranges covered, so the message can be specific. */
  quietWindow: string;
}

/**
 * Buckets the affected customers by whether it's a civilised hour where they
 * are. The local hour is computed from the real clock, so this returns a
 * different split at 9am than at midnight -- which is the point.
 */
export function inspectAudience(now: Date = new Date()): AudienceSlice {
  const rows = getDb()
    .prepare(
      `SELECT utc_offset AS offset, zone, COUNT(*) AS n
         FROM customers GROUP BY utc_offset, zone ORDER BY utc_offset`,
    )
    .all() as Array<{ offset: number; zone: string; n: number }>;

  const utcHour = now.getUTCHours();
  let awake = 0;
  let asleep = 0;
  const asleepZones: string[] = [];

  for (const row of rows) {
    const localHour = (((utcHour + row.offset) % 24) + 24) % 24;
    if (isQuietHour(localHour)) {
      asleep += row.n;
      asleepZones.push(row.zone);
    } else {
      awake += row.n;
    }
  }

  return {
    total: awake + asleep,
    awake,
    asleep,
    asleepZones: asleepZones.slice(0, 3),
    quietWindow: `${QUIET_START_HOUR}:00–0${QUIET_END_HOUR}:00`,
  };
}

export interface SendResult {
  sentNow: number;
  scheduled: number;
}

/**
 * Records the notification against every affected customer. Sending is
 * simulated -- this writes real rows to the real local database, but no
 * message actually leaves the machine. The only genuine Twilio traffic in
 * this demo is the escalation to the presenter.
 */
export function sendNotice(
  holdUntilMorning: boolean,
  decidedBy: string,
  now: Date = new Date(),
): SendResult {
  const database = getDb();
  const slice = inspectAudience(now);
  const stamp = now.toISOString();
  const utcHour = now.getUTCHours();

  database.exec('BEGIN');

  if (holdUntilMorning) {
    // Everyone awake hears about it now; the rest are queued for 8am local.
    for (const offset of OFFSETS) {
      const localHour = (((utcHour + offset) % 24) + 24) % 24;
      if (isQuietHour(localHour)) {
        const hoursUntil8 = (8 - localHour + 24) % 24;
        const when = new Date(now.getTime() + hoursUntil8 * 3_600_000).toISOString();
        database
          .prepare(`UPDATE customers SET scheduled_for = ? WHERE utc_offset = ?`)
          .run(when, offset);
      } else {
        database
          .prepare(`UPDATE customers SET notified_at = ? WHERE utc_offset = ?`)
          .run(stamp, offset);
      }
    }
  } else {
    database.prepare(`UPDATE customers SET notified_at = ?`).run(stamp);
  }

  const log = database.prepare(
    `INSERT INTO send_log (batch, recipients, decided_by, created_at) VALUES (?, ?, ?, ?)`,
  );
  const sentNow = holdUntilMorning ? slice.awake : slice.total;
  const scheduled = holdUntilMorning ? slice.asleep : 0;
  log.run('immediate', sentNow, decidedBy, stamp);
  if (scheduled > 0) log.run('held-until-morning', scheduled, decidedBy, stamp);

  database.exec('COMMIT');

  return { sentNow, scheduled };
}
