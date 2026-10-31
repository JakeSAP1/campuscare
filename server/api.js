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
  const db = loadDb();
  const now = Date.now();
  let changed = false;
  for (const booking of db.bookings) {
    if (booking.status !== 'confirmed' || booking.reminderSent) continue;
    if (![booking.studentId, booking.specialistId].includes(req.user.id)) continue;
    const start = new Date(booking.start).getTime();
    if (start > now && start - now <= 24 * 60 * 60 * 1000) {
      booking.reminderSent = true;
      notify(db, booking.studentId, 'reminder', `Напоминание: консультация ${fmtServer(booking.start)} (${booking.format === 'online' ? 'онлайн' : 'очно'})`);
      notify(db, booking.specialistId, 'reminder', `Напоминание: консультация с ${userById(db, booking.studentId).name} ${fmtServer(booking.start)}`);
      changed = true;
    }
  }
  if (changed) saveDb();
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

/* --- записи на консультации --- */

const requireRole = (role) => (req, res, next) => {
  if (req.user.role !== role) return res.status(403).json({ error: 'Недоступно для вашей роли' });
  next();
};

const notify = (db, userId, type, text) => {
  db.notifications.push({
    id: newId(),
    userId,
    type,
    text,
    read: false,
    createdAt: new Date().toISOString(),
  });
};

const pad = (value) => String(value).padStart(2, '0');
const fmtServer = (iso) => {
  const date = new Date(iso);
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const bookingView = (db, booking, viewer) => {
  const student = userById(db, booking.studentId);
  const specialist = userById(db, booking.specialistId);
  const review = db.reviews.find((r) => r.bookingId === booking.id);
  const isStudent = viewer.id === booking.studentId;
  const isSpecialist = viewer.id === booking.specialistId;
  return {
    id: booking.id,
    start: booking.start,
    durationMin: booking.durationMin,
    format: booking.format,
    status: booking.status,
    createdAt: booking.createdAt,
    cancelReason: booking.cancelReason || '',
    specialist: { id: specialist.id, name: specialist.name, typeLabel: TYPES[specialist.type] },
    student: { id: student.id, name: student.name },
    ...(isStudent
      ? { studentNote: booking.studentNote || '', canReview: booking.status === 'completed' && !review }
      : {}),
    ...(isSpecialist ? { questionnaire: booking.questionnaire, specNote: booking.specNote || '' } : {}),
  };
};

const findBooking = (db, id) => db.bookings.find((b) => b.id === id);

api.post('/bookings', requireAuth, requireRole('student'), (req, res) => {
  const db = loadDb();
  const { slotId, format, questionnaire } = req.body || {};

  const slot = db.slots.find((s) => s.id === slotId);
  if (!slot || slot.status !== 'free') return res.status(400).json({ error: 'Слот недоступен' });
  if (new Date(slot.start).getTime() <= Date.now()) return res.status(400).json({ error: 'Время этого слота уже прошло' });

  const specialist = userById(db, slot.specialistId);
  if (!specialist.formats.includes(format)) return res.status(400).json({ error: 'Специалист не принимает в этом формате' });

  const isFirst = !db.bookings.some((b) =>
    b.studentId === req.user.id &&
    b.specialistId === specialist.id &&
    ['pending', 'confirmed', 'completed'].includes(b.status));

  let filled = null;
  if (isFirst) {
    const q = questionnaire || {};
    const course = String(q.course || '').trim();
    const request = String(q.request || '').trim();
    if (!course || !request) return res.status(400).json({ error: 'Перед первой консультацией заполните анкету: курс и запрос' });
    filled = { course, request, experience: String(q.experience || '').trim(), notes: String(q.notes || '').trim() };
  }

  slot.status = 'booked';
  const booking = {
    id: newId(),
    studentId: req.user.id,
    specialistId: specialist.id,
    slotId: slot.id,
    start: slot.start,
    durationMin: slot.durationMin,
    format,
    status: 'pending',
    questionnaire: filled,
    specNote: '',
    studentNote: '',
    cancelReason: '',
    reminderSent: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  db.bookings.push(booking);

  notify(db, specialist.id, 'booking_new', `Новая заявка на ${fmtServer(booking.start)} от ${req.user.name}`);
  saveDb();
  res.json({ booking: bookingView(db, booking, req.user) });
});

api.get('/my/bookings', requireAuth, requireRole('student'), (req, res) => {
  const db = loadDb();
  const bookings = db.bookings
    .filter((b) => b.studentId === req.user.id)
    .sort((a, b) => new Date(b.start) - new Date(a.start))
    .map((b) => bookingView(db, b, req.user));
  res.json({ bookings });
});

api.post('/bookings/:id/confirm', requireAuth, (req, res) => {
  const db = loadDb();
  const booking = findBooking(db, req.params.id);
  if (!booking) return res.status(404).json({ error: 'Запись не найдена' });
  if (![booking.studentId, booking.specialistId].includes(req.user.id)) return res.status(403).json({ error: 'Это не ваша запись' });
  if (booking.status !== 'pending') return res.status(400).json({ error: 'Подтвердить можно только заявку, ожидающую подтверждения' });

  booking.status = 'confirmed';
  booking.updatedAt = new Date().toISOString();
  const otherId = req.user.id === booking.studentId ? booking.specialistId : booking.studentId;
  notify(db, otherId, 'booking_confirmed', req.user.id === booking.specialistId
    ? `Консультация ${fmtServer(booking.start)} подтверждена`
    : `${req.user.name} подтвердил(а) консультацию ${fmtServer(booking.start)}`);
  saveDb();
  res.json({ booking: bookingView(db, booking, req.user) });
});

api.post('/bookings/:id/cancel', requireAuth, (req, res) => {
  const db = loadDb();
  const booking = findBooking(db, req.params.id);
  if (!booking) return res.status(404).json({ error: 'Запись не найдена' });
  if (![booking.studentId, booking.specialistId].includes(req.user.id)) return res.status(403).json({ error: 'Это не ваша запись' });
  if (!['pending', 'confirmed'].includes(booking.status)) return res.status(400).json({ error: 'Эту запись уже нельзя отменить' });

  booking.status = 'cancelled';
  booking.cancelReason = String((req.body || {}).reason || '').trim();
  booking.updatedAt = new Date().toISOString();
  const slot = db.slots.find((s) => s.id === booking.slotId);
  if (slot) slot.status = 'free';

  const otherId = req.user.id === booking.studentId ? booking.specialistId : booking.studentId;
  notify(db, otherId, 'booking_cancelled', `Консультация ${fmtServer(booking.start)} отменена${booking.cancelReason ? `: ${booking.cancelReason}` : ''}`);
  saveDb();
  res.json({ booking: bookingView(db, booking, req.user) });
});

/* --- кабинет специалиста --- */

api.get('/my/schedule', requireAuth, requireRole('specialist'), (req, res) => {
  const db = loadDb();
  const bookings = db.bookings
    .filter((b) => b.specialistId === req.user.id)
    .sort((a, b) => new Date(a.start) - new Date(b.start))
    .map((b) => bookingView(db, b, req.user));
  res.json({ bookings });
});

api.post('/bookings/:id/reschedule', requireAuth, requireRole('specialist'), (req, res) => {
  const db = loadDb();
  const booking = findBooking(db, req.params.id);
  if (!booking) return res.status(404).json({ error: 'Запись не найдена' });
  if (booking.specialistId !== req.user.id) return res.status(403).json({ error: 'Это не ваша запись' });
  if (!['pending', 'confirmed'].includes(booking.status)) return res.status(400).json({ error: 'Эту запись нельзя перенести' });

  const slot = db.slots.find((s) => s.id === (req.body || {}).slotId);
  if (!slot || slot.status !== 'free' || new Date(slot.start).getTime() <= Date.now()) {
    return res.status(400).json({ error: 'Выберите свободный будущий слот' });
  }

  const oldSlot = db.slots.find((s) => s.id === booking.slotId);
  if (oldSlot) oldSlot.status = 'free';
  slot.status = 'booked';
  booking.slotId = slot.id;
  booking.start = slot.start;
  booking.durationMin = slot.durationMin;
  booking.status = 'pending';
  booking.updatedAt = new Date().toISOString();

  notify(db, booking.studentId, 'booking_rescheduled', `Специалист предложил другое время: ${fmtServer(booking.start)} — подтвердите в кабинете`);
  saveDb();
  res.json({ booking: bookingView(db, booking, req.user) });
});

api.post('/bookings/:id/complete', requireAuth, requireRole('specialist'), (req, res) => {
  const db = loadDb();
  const booking = findBooking(db, req.params.id);
  if (!booking) return res.status(404).json({ error: 'Запись не найдена' });
  if (booking.specialistId !== req.user.id) return res.status(403).json({ error: 'Это не ваша запись' });
  if (booking.status !== 'confirmed') return res.status(400).json({ error: 'Провести можно только подтверждённую запись' });

  booking.status = 'completed';
  booking.updatedAt = new Date().toISOString();
  notify(db, booking.studentId, 'booking_completed', `Консультация ${fmtServer(booking.start)} завершена`);
  saveDb();
  res.json({ booking: bookingView(db, booking, req.user) });
});

api.post('/bookings/:id/spec-note', requireAuth, requireRole('specialist'), (req, res) => {
  const db = loadDb();
  const booking = findBooking(db, req.params.id);
  if (!booking) return res.status(404).json({ error: 'Запись не найдена' });
  if (booking.specialistId !== req.user.id) return res.status(403).json({ error: 'Это не ваша запись' });

  booking.specNote = String((req.body || {}).text || '').trim();
  booking.updatedAt = new Date().toISOString();
  saveDb();
  res.json({ booking: bookingView(db, booking, req.user) });
});

api.get('/my/clients', requireAuth, requireRole('specialist'), (req, res) => {
  const db = loadDb();
  const byStudent = new Map();
  for (const booking of db.bookings.filter((b) => b.specialistId === req.user.id && b.status !== 'cancelled')) {
    const entry = byStudent.get(booking.studentId)
      || { id: booking.studentId, name: userById(db, booking.studentId).name, visits: 0, lastStart: null };
    entry.visits += 1;
    if (!entry.lastStart || new Date(booking.start) > new Date(entry.lastStart)) entry.lastStart = booking.start;
    byStudent.set(booking.studentId, entry);
  }
  const clients = [...byStudent.values()].sort((a, b) => new Date(b.lastStart) - new Date(a.lastStart));
  res.json({ clients });
});

/* --- отзывы --- */

api.post('/reviews', requireAuth, requireRole('student'), (req, res) => {
  const db = loadDb();
  const { bookingId, rating, text } = req.body || {};

  const booking = findBooking(db, bookingId);
  if (!booking) return res.status(404).json({ error: 'Запись не найдена' });
  if (booking.studentId !== req.user.id) return res.status(403).json({ error: 'Это не ваша запись' });
  if (booking.status !== 'completed') return res.status(400).json({ error: 'Отзыв можно оставить только после проведённой консультации' });
  if (db.reviews.some((r) => r.bookingId === booking.id)) return res.status(400).json({ error: 'Отзыв к этой консультации уже оставлен' });

  const score = Number(rating);
  if (!Number.isInteger(score) || score < 1 || score > 5) return res.status(400).json({ error: 'Оценка — целое число от 1 до 5' });

  const review = {
    id: newId(),
    bookingId: booking.id,
    specialistId: booking.specialistId,
    studentId: req.user.id,
    rating: score,
    text: String(text || '').trim(),
    createdAt: new Date().toISOString(),
  };
  db.reviews.push(review);
  notify(db, booking.specialistId, 'review_new', `Новый отзыв: ${score} из 5 о ваших консультациях`);
  saveDb();
  res.json({ review: { rating: review.rating, text: review.text, createdAt: review.createdAt } });
});

/* --- уведомления --- */

api.get('/notifications', requireAuth, (req, res) => {
  const db = loadDb();
  const list = db.notifications
    .filter((n) => n.userId === req.user.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map(({ id, type, text, read, createdAt }) => ({ id, type, text, read, createdAt }));
  res.json({ notifications: list, unread: list.filter((n) => !n.read).length });
});

api.post('/notifications/read', requireAuth, (req, res) => {
  const db = loadDb();
  db.notifications.forEach((n) => {
    if (n.userId === req.user.id) n.read = true;
  });
  saveDb();
  res.json({ ok: true });
});
