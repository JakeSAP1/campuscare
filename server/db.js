import { mkdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { seedIfEmpty } from './seed.js';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dbFile = join(root, 'data', 'campuscare.db');

mkdirSync(dirname(dbFile), { recursive: true });

export const db = new DatabaseSync(dbFile);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('student', 'specialist')),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  pass_hash TEXT NOT NULL,
  type TEXT,
  specialization TEXT NOT NULL DEFAULT '',
  bio TEXT NOT NULL DEFAULT '',
  formats TEXT NOT NULL DEFAULT '["online"]',
  work_from INTEGER NOT NULL DEFAULT 10,
  work_to INTEGER NOT NULL DEFAULT 18,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS slots (
  id TEXT PRIMARY KEY,
  specialist_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  start TEXT NOT NULL,
  duration_min INTEGER NOT NULL DEFAULT 50,
  status TEXT NOT NULL DEFAULT 'free' CHECK (status IN ('free', 'booked'))
);
CREATE INDEX IF NOT EXISTS idx_slots_spec ON slots(specialist_id, status, start);

CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES users(id),
  specialist_id TEXT NOT NULL REFERENCES users(id),
  slot_id TEXT REFERENCES slots(id),
  start TEXT NOT NULL,
  duration_min INTEGER NOT NULL DEFAULT 50,
  format TEXT NOT NULL CHECK (format IN ('online', 'offline')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
  questionnaire TEXT,
  spec_note TEXT NOT NULL DEFAULT '',
  student_note TEXT NOT NULL DEFAULT '',
  cancel_reason TEXT NOT NULL DEFAULT '',
  reminder_sent INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_bookings_student ON bookings(student_id, start);
CREATE INDEX IF NOT EXISTS idx_bookings_spec ON bookings(specialist_id, start);

CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL UNIQUE REFERENCES bookings(id),
  specialist_id TEXT NOT NULL REFERENCES users(id),
  student_id TEXT NOT NULL REFERENCES users(id),
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  text TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reviews_spec ON reviews(specialist_id);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  text TEXT NOT NULL,
  read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at);
`);

seedIfEmpty(db);
