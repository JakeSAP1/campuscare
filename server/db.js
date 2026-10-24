import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSeed } from './seed.js';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dataFile = join(root, 'data', 'db.json');

let db = null;

export function loadDb() {
  if (db) return db;
  mkdirSync(dirname(dataFile), { recursive: true });
  if (existsSync(dataFile)) {
    db = JSON.parse(readFileSync(dataFile, 'utf8'));
  } else {
    db = buildSeed();
    saveDb();
  }
  return db;
}

export function saveDb() {
  const tmp = `${dataFile}.tmp`;
  writeFileSync(tmp, JSON.stringify(db, null, 2));
  renameSync(tmp, dataFile);
}

export const newId = () => globalThis.crypto.randomUUID();
