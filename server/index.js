import express from 'express';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadDb } from './db.js';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

loadDb();

const app = express();
app.use(express.json());
app.use(express.static(join(root, 'public')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`CampusCare: http://localhost:${PORT}`);
});
