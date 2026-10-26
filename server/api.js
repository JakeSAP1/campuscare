import { Router } from 'express';
import { loadDb, saveDb, newId } from './db.js';
import { hashPassword, verifyPassword } from './passwords.js';

export const TYPES = {
  psychologist: 'Психолог',
  career: 'Карьерный консультант',
  tutor: 'Тьютор',
};

export const userById = (db, id) => db.users.find((u) => u.id === id);
const findByEmail = (db, email) => db.users.find((u) => u.email.toLowerCase() === String(email).trim().toLowerCase());

export function publicUser(user) {
  if (!user) return null;
  const base = { id: user.id, role: user.role, name: user.name, email: user.email };
  if (user.role !== 'specialist') return base;
  return {
    ...base,
    type: user.type,
    typeLabel: TYPES[user.type],
    specialization: user.specialization,
    bio: user.bio,
    formats: user.formats,
    workFrom: user.workFrom,
    workTo: user.workTo,
  };
}

function currentUser(req) {
  const db = loadDb();
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  const token = header.slice(7);
  const session = db.sessions.find((s) => s.token === token);
  return session ? userById(db, session.userId) : null;
}

const requireAuth = (req, res, next) => {
  const user = currentUser(req);
  if (!user) return res.status(401).json({ error: 'Требуется вход' });
  req.user = user;
  next();
};

function startSession(db, user) {
  const token = newId() + newId();
  db.sessions.push({ token, userId: user.id, createdAt: new Date().toISOString() });
  return token;
}

export const api = Router();

api.post('/register', (req, res) => {
  const db = loadDb();
  const { role, name, email, password, specialist } = req.body || {};

  if (!['student', 'specialist'].includes(role)) return res.status(400).json({ error: 'Выберите роль' });
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'Укажите имя' });
  if (!email || !String(email).includes('@')) return res.status(400).json({ error: 'Укажите корректный e-mail' });
  if (!password || String(password).length < 6) return res.status(400).json({ error: 'Пароль должен быть не короче 6 символов' });
  if (findByEmail(db, email)) return res.status(400).json({ error: 'Пользователь с таким e-mail уже зарегистрирован' });

  const user = {
    id: newId(),
    role,
    name: String(name).trim(),
    email: String(email).trim().toLowerCase(),
    passHash: hashPassword(String(password)),
    createdAt: new Date().toISOString(),
  };

  if (role === 'specialist') {
    const s = specialist || {};
    if (!TYPES[s.type]) return res.status(400).json({ error: 'Выберите тип консультаций' });
    const workFrom = Math.max(7, Math.min(Number(s.workFrom) || 10, 12));
    const formats = Array.isArray(s.formats) ? s.formats.filter((f) => f === 'online' || f === 'offline') : [];
    user.type = s.type;
    user.specialization = String(s.specialization || '').trim() || TYPES[s.type];
    user.bio = String(s.bio || '').trim();
    user.formats = formats.length ? formats : ['online'];
    user.workFrom = workFrom;
    user.workTo = Math.min(21, Math.max(Number(s.workTo) || 18, workFrom + 1));
  }

  db.users.push(user);
  const token = startSession(db, user);
  saveDb();
  res.json({ token, user: publicUser(user) });
});

api.post('/login', (req, res) => {
  const db = loadDb();
  const { email, password } = req.body || {};
  const user = findByEmail(db, email || '');
  if (!user || !verifyPassword(String(password || ''), user.passHash)) {
    return res.status(401).json({ error: 'Неверный e-mail или пароль' });
  }
  const token = startSession(db, user);
  saveDb();
  res.json({ token, user: publicUser(user) });
});

api.post('/logout', requireAuth, (req, res) => {
  const db = loadDb();
  db.sessions = db.sessions.filter((s) => s.token !== req.headers.authorization.slice(7));
  saveDb();
  res.json({ ok: true });
});

api.get('/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

const ratingOf = (db, specialistId) => {
  const list = db.reviews.filter((r) => r.specialistId === specialistId);
  const avg = list.length ? list.reduce((sum, r) => sum + r.rating, 0) / list.length : 0;
  return { rating: Math.round(avg * 10) / 10, reviewsCount: list.length };
};

const specialistCard = (db, user) => ({
  id: user.id,
  name: user.name,
  type: user.type,
  typeLabel: TYPES[user.type],
  specialization: user.specialization,
  formats: user.formats,
  ...ratingOf(db, user.id),
});

const findSpecialist = (db, id) => db.users.find((u) => u.role === 'specialist' && u.id === id);
const notFound = (res) => res.status(404).json({ error: 'Специалист не найден' });

api.get('/specialists', (req, res) => {
  const db = loadDb();
  const { type, format } = req.query;
  let list = db.users.filter((u) => u.role === 'specialist');
  if (TYPES[type]) list = list.filter((u) => u.type === type);
  if (format === 'online' || format === 'offline') list = list.filter((u) => u.formats.includes(format));
  res.json({ specialists: list.map((u) => specialistCard(db, u)) });
});

api.get('/specialists/:id', (req, res) => {
  const db = loadDb();
  const spec = findSpecialist(db, req.params.id);
  if (!spec) return notFound(res);
  res.json({ specialist: { ...publicUser(spec), ...ratingOf(db, spec.id) } });
});

api.get('/specialists/:id/slots', (req, res) => {
  const db = loadDb();
  const spec = findSpecialist(db, req.params.id);
  if (!spec) return notFound(res);
  const now = Date.now();
  const slots = db.slots
    .filter((s) => s.specialistId === spec.id && s.status === 'free' && new Date(s.start).getTime() > now)
    .sort((a, b) => new Date(a.start) - new Date(b.start))
    .map(({ id, start, durationMin }) => ({ id, start, durationMin }));
  res.json({ slots });
});

api.get('/specialists/:id/reviews', (req, res) => {
  const db = loadDb();
  const spec = findSpecialist(db, req.params.id);
  if (!spec) return notFound(res);
  const reviews = db.reviews
    .filter((r) => r.specialistId === spec.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map(({ rating, text, createdAt }) => ({ rating, text, createdAt }));
  res.json({ reviews });
});
