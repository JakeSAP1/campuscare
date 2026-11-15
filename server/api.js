import { Router } from 'express';
import { db } from './db.js';
import { hashPassword, verifyPassword } from './passwords.js';

export const TYPES = {
  psychologist: 'Психолог',
  career: 'Карьерный консультант',
  tutor: 'Тьютор',
};

const rowUser = (row) => row && ({
  id: row.id,
  role: row.role,
  name: row.name,
  email: row.email,
  passHash: row.pass_hash,
  type: row.type,
  specialization: row.specialization,
  bio: row.bio,
  formats: JSON.parse(row.formats || '[]'),
  workFrom: row.work_from,
  workTo: row.work_to,
  createdAt: row.created_at,
});

const userById = (id) => rowUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id));
const findByEmail = (email) => rowUser(db.prepare('SELECT * FROM users WHERE lower(email) = lower(?)').get(String(email).trim()));

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
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  const token = header.slice(7);
  const session = db.prepare('SELECT user_id FROM sessions WHERE token = ?').get(token);
  return session ? userById(session.user_id) : null;
}

const requireAuth = (req, res, next) => {
  const user = currentUser(req);
  if (!user) return res.status(401).json({ error: 'Требуется вход' });
  req.user = user;
  next();
};

const requireRole = (role) => (req, res, next) => {
  if (req.user.role !== role) return res.status(403).json({ error: 'Недоступно для вашей роли' });
  next();
};

function startSession(userId) {
  const token = crypto.randomUUID() + crypto.randomUUID();
  db.prepare('INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)')
    .run(token, userId, new Date().toISOString());
  return token;
}

const notify = (userId, type, text) => {
  db.prepare('INSERT INTO notifications (id, user_id, type, text, read, created_at) VALUES (?, ?, ?, ?, 0, ?)')
    .run(crypto.randomUUID(), userId, type, text, new Date().toISOString());
};

const pad = (value) => String(value).padStart(2, '0');
const fmtServer = (isoDate) => {
  const date = new Date(isoDate);
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const BOOKING_SELECT = `
  SELECT b.*, su.name AS student_name, pu.name AS specialist_name, pu.type AS specialist_type,
    EXISTS(SELECT 1 FROM reviews r WHERE r.booking_id = b.id) AS has_review
  FROM bookings b
  JOIN users su ON su.id = b.student_id
  JOIN users pu ON pu.id = b.specialist_id
`;

const rowBooking = (row) => row && ({
  id: row.id,
  studentId: row.student_id,
  specialistId: row.specialist_id,
  slotId: row.slot_id,
  start: row.start,
  durationMin: row.duration_min,
  format: row.format,
  status: row.status,
  questionnaire: row.questionnaire ? JSON.parse(row.questionnaire) : null,
  specNote: row.spec_note,
  studentNote: row.student_note,
  cancelReason: row.cancel_reason,
  reminderSent: !!row.reminder_sent,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  studentName: row.student_name,
  specialistName: row.specialist_name,
  specialistType: row.specialist_type,
  hasReview: !!row.has_review,
});

const getBooking = (id) => rowBooking(db.prepare(`${BOOKING_SELECT} WHERE b.id = ?`).get(id));

const bookingView = (booking, viewer) => {
  const isStudent = viewer.id === booking.studentId;
  const isSpecialist = viewer.id === booking.specialistId;
  return {
    id: booking.id,
    start: booking.start,
    durationMin: booking.durationMin,
    format: booking.format,
    status: booking.status,
    createdAt: booking.createdAt,
    cancelReason: booking.cancelReason,
    specialist: { id: booking.specialistId, name: booking.specialistName, typeLabel: TYPES[booking.specialistType] },
    student: { id: booking.studentId, name: booking.studentName },
    ...(isStudent
      ? {
          studentNote: booking.studentNote,
          canReview: booking.status === 'completed' && !booking.hasReview,
          questionnaire: booking.questionnaire,
        }
      : {}),
    ...(isSpecialist ? { questionnaire: booking.questionnaire, specNote: booking.specNote } : {}),
  };
};

export const api = Router();

/* --- авторизация --- */

api.post('/register', (req, res) => {
  const { role, name, email, password, specialist } = req.body || {};

  if (!['student', 'specialist'].includes(role)) return res.status(400).json({ error: 'Выберите роль' });
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'Укажите имя' });
  if (!email || !String(email).includes('@')) return res.status(400).json({ error: 'Укажите корректный e-mail' });
  if (!password || String(password).length < 6) return res.status(400).json({ error: 'Пароль должен быть не короче 6 символов' });
  if (findByEmail(email)) return res.status(400).json({ error: 'Пользователь с таким e-mail уже зарегистрирован' });

  const user = {
    id: crypto.randomUUID(),
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

  db.prepare(`
    INSERT INTO users (id, role, name, email, pass_hash, type, specialization, bio, formats, work_from, work_to, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(
      user.id, user.role, user.name, user.email, user.passHash,
      user.type ?? null, user.specialization ?? '', user.bio ?? '',
      JSON.stringify(user.formats ?? ['online']), user.workFrom ?? 10, user.workTo ?? 18, user.createdAt,
    );

  const token = startSession(user.id);
  res.json({ token, user: publicUser(user) });
});

api.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  const user = findByEmail(email || '');
  if (!user || !verifyPassword(String(password || ''), user.passHash)) {
    return res.status(401).json({ error: 'Неверный e-mail или пароль' });
  }
  const token = startSession(user.id);
  res.json({ token, user: publicUser(user) });
});

api.post('/logout', requireAuth, (req, res) => {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(req.headers.authorization.slice(7));
  res.json({ ok: true });
});

export function sendDueReminders() {
  const now = Date.now();
  const due = db.prepare(`
    SELECT * FROM bookings
    WHERE status = 'confirmed' AND reminder_sent = 0 AND start > ? AND start <= ?`)
    .all(new Date(now).toISOString(), new Date(now + 24 * 60 * 60 * 1000).toISOString());

  const markReminded = db.prepare('UPDATE bookings SET reminder_sent = 1 WHERE id = ?');
  for (const row of due) {
    markReminded.run(row.id);
    notify(row.student_id, 'reminder', `Напоминание: консультация ${fmtServer(row.start)} (${row.format === 'online' ? 'онлайн' : 'очно'})`);
    notify(row.specialist_id, 'reminder', `Напоминание: консультация с ${userById(row.student_id).name} ${fmtServer(row.start)}`);
  }
  return due.length;
}

api.get('/me', requireAuth, (req, res) => {
  sendDueReminders();
  res.json({ user: publicUser(req.user) });
});

api.patch('/me', requireAuth, (req, res) => {
  const name = String((req.body || {}).name || '').trim();
  if (!name) return res.status(400).json({ error: 'Укажите имя' });
  if (name.length > 80) return res.status(400).json({ error: 'Имя слишком длинное' });

  db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name, req.user.id);
  res.json({ user: publicUser(userById(req.user.id)) });
});

api.post('/me/password', requireAuth, (req, res) => {
  const { oldPassword, newPassword } = req.body || {};
  if (!verifyPassword(String(oldPassword || ''), req.user.passHash)) {
    return res.status(400).json({ error: 'Старый пароль неверен' });
  }
  if (!newPassword || String(newPassword).length < 6) {
    return res.status(400).json({ error: 'Новый пароль должен быть не короче 6 символов' });
  }

  db.prepare('UPDATE users SET pass_hash = ? WHERE id = ?')
    .run(hashPassword(String(newPassword)), req.user.id);
  res.json({ ok: true });
});

/* --- каталог --- */

const SPECIALIST_SELECT = `
  SELECT u.*,
    (SELECT ROUND(COALESCE(AVG(r.rating), 0) * 10) / 10 FROM reviews r WHERE r.specialist_id = u.id) AS rating,
    (SELECT COUNT(*) FROM reviews r WHERE r.specialist_id = u.id) AS reviews_count
  FROM users u
  WHERE u.role = 'specialist'
`;

const specialistCard = (row) => ({
  id: row.id,
  name: row.name,
  type: row.type,
  typeLabel: TYPES[row.type],
  specialization: row.specialization,
  formats: JSON.parse(row.formats || '[]'),
  rating: row.rating,
  reviewsCount: row.reviews_count,
});

const findSpecialist = (id) => db.prepare(`${SPECIALIST_SELECT} AND u.id = ?`).get(id);
const notFound = (res) => res.status(404).json({ error: 'Специалист не найден' });

api.get('/specialists', (req, res) => {
  const { type, format } = req.query;
  let sql = SPECIALIST_SELECT;
  const params = [];
  if (TYPES[type]) {
    sql += ' AND u.type = ?';
    params.push(type);
  }
  if (format === 'online' || format === 'offline') {
    sql += ' AND u.formats LIKE ?';
    params.push(`%"${format}"%`);
  }
  res.json({ specialists: db.prepare(sql).all(...params).map(specialistCard) });
});

api.get('/specialists/:id', (req, res) => {
  const row = findSpecialist(req.params.id);
  if (!row) return notFound(res);
  res.json({ specialist: { ...publicUser(rowUser(row)), rating: row.rating, reviewsCount: row.reviews_count } });
});

api.get('/specialists/:id/slots', (req, res) => {
  const row = findSpecialist(req.params.id);
  if (!row) return notFound(res);
  const slots = db.prepare(`
    SELECT id, start, duration_min FROM slots
    WHERE specialist_id = ? AND status = 'free' AND start > ?
    ORDER BY start`)
    .all(row.id, new Date().toISOString())
    .map(({ id, start, duration_min }) => ({ id, start, durationMin: duration_min }));
  res.json({ slots });
});

api.get('/specialists/:id/reviews', (req, res) => {
  const row = findSpecialist(req.params.id);
  if (!row) return notFound(res);
  const reviews = db.prepare(`
    SELECT rating, text, created_at FROM reviews WHERE specialist_id = ? ORDER BY created_at DESC`)
    .all(row.id)
    .map(({ rating, text, created_at }) => ({ rating, text, createdAt: created_at }));
  res.json({ reviews });
});

/* --- записи на консультации --- */

api.post('/bookings', requireAuth, requireRole('student'), (req, res) => {
  const { slotId, format, questionnaire } = req.body || {};

  const slot = db.prepare('SELECT * FROM slots WHERE id = ?').get(slotId);
  if (!slot || slot.status !== 'free') return res.status(400).json({ error: 'Слот недоступен' });
  if (new Date(slot.start).getTime() <= Date.now()) return res.status(400).json({ error: 'Время этого слота уже прошло' });

  const specialist = userById(slot.specialist_id);
  if (!specialist.formats.includes(format)) return res.status(400).json({ error: 'Специалист не принимает в этом формате' });

  const isFirst = db.prepare(`
    SELECT COUNT(*) AS n FROM bookings
    WHERE student_id = ? AND specialist_id = ? AND status IN ('pending', 'confirmed', 'completed')`)
    .get(req.user.id, specialist.id).n === 0;

  let filled = null;
  if (isFirst) {
    const q = questionnaire || {};
    const course = String(q.course || '').trim();
    const request = String(q.request || '').trim();
    if (!course || !request) return res.status(400).json({ error: 'Перед первой консультацией заполните анкету: курс и запрос' });
    filled = { course, request, experience: String(q.experience || '').trim(), notes: String(q.notes || '').trim() };
  }

  const bookingId = crypto.randomUUID();
  const nowIso = new Date().toISOString();
  db.prepare(`
    INSERT INTO bookings (id, student_id, specialist_id, slot_id, start, duration_min, format, status,
      questionnaire, spec_note, student_note, cancel_reason, reminder_sent, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, '', '', '', 0, ?, ?)`)
    .run(bookingId, req.user.id, specialist.id, slot.id, slot.start, slot.duration_min, format,
      filled ? JSON.stringify(filled) : null, nowIso, nowIso);
  db.prepare(`UPDATE slots SET status = 'booked' WHERE id = ?`).run(slot.id);

  notify(specialist.id, 'booking_new', `Новая заявка на ${fmtServer(slot.start)} от ${req.user.name}`);
  res.json({ booking: bookingView(getBooking(bookingId), req.user) });
});

api.get('/my/bookings', requireAuth, requireRole('student'), (req, res) => {
  const bookings = db.prepare(`${BOOKING_SELECT} WHERE b.student_id = ? ORDER BY b.start DESC`)
    .all(req.user.id)
    .map((row) => bookingView(rowBooking(row), req.user));
  res.json({ bookings });
});

api.post('/bookings/:id/confirm', requireAuth, (req, res) => {
  const booking = getBooking(req.params.id);
  if (!booking) return res.status(404).json({ error: 'Запись не найдена' });
  if (![booking.studentId, booking.specialistId].includes(req.user.id)) return res.status(403).json({ error: 'Это не ваша запись' });
  if (booking.status !== 'pending') return res.status(400).json({ error: 'Подтвердить можно только заявку, ожидающую подтверждения' });

  db.prepare(`UPDATE bookings SET status = 'confirmed', updated_at = ? WHERE id = ?`)
    .run(new Date().toISOString(), booking.id);

  const otherId = req.user.id === booking.studentId ? booking.specialistId : booking.studentId;
  notify(otherId, 'booking_confirmed', req.user.id === booking.specialistId
    ? `Консультация ${fmtServer(booking.start)} подтверждена`
    : `${req.user.name} подтвердил(а) консультацию ${fmtServer(booking.start)}`);
  res.json({ booking: bookingView(getBooking(booking.id), req.user) });
});

api.post('/bookings/:id/cancel', requireAuth, (req, res) => {
  const booking = getBooking(req.params.id);
  if (!booking) return res.status(404).json({ error: 'Запись не найдена' });
  if (![booking.studentId, booking.specialistId].includes(req.user.id)) return res.status(403).json({ error: 'Это не ваша запись' });
  if (!['pending', 'confirmed'].includes(booking.status)) return res.status(400).json({ error: 'Эту запись уже нельзя отменить' });

  const reason = String((req.body || {}).reason || '').trim();
  db.prepare(`UPDATE bookings SET status = 'cancelled', cancel_reason = ?, updated_at = ? WHERE id = ?`)
    .run(reason, new Date().toISOString(), booking.id);
  if (booking.slotId) {
    db.prepare(`UPDATE slots SET status = 'free' WHERE id = ?`).run(booking.slotId);
  }

  const otherId = req.user.id === booking.studentId ? booking.specialistId : booking.studentId;
  notify(otherId, 'booking_cancelled', `Консультация ${fmtServer(booking.start)} отменена${reason ? `: ${reason}` : ''}`);
  res.json({ booking: bookingView(getBooking(booking.id), req.user) });
});

/* --- кабинет специалиста --- */

api.get('/my/schedule', requireAuth, requireRole('specialist'), (req, res) => {
  const bookings = db.prepare(`${BOOKING_SELECT} WHERE b.specialist_id = ? ORDER BY b.start ASC`)
    .all(req.user.id)
    .map((row) => bookingView(rowBooking(row), req.user));
  res.json({ bookings });
});

api.post('/bookings/:id/reschedule', requireAuth, requireRole('specialist'), (req, res) => {
  const booking = getBooking(req.params.id);
  if (!booking) return res.status(404).json({ error: 'Запись не найдена' });
  if (booking.specialistId !== req.user.id) return res.status(403).json({ error: 'Это не ваша запись' });
  if (!['pending', 'confirmed'].includes(booking.status)) return res.status(400).json({ error: 'Эту запись нельзя перенести' });

  const slot = db.prepare('SELECT * FROM slots WHERE id = ?').get((req.body || {}).slotId);
  if (!slot || slot.status !== 'free' || new Date(slot.start).getTime() <= Date.now()) {
    return res.status(400).json({ error: 'Выберите свободный будущий слот' });
  }

  const nowIso = new Date().toISOString();
  if (booking.slotId) {
    db.prepare(`UPDATE slots SET status = 'free' WHERE id = ?`).run(booking.slotId);
  }
  db.prepare(`UPDATE slots SET status = 'booked' WHERE id = ?`).run(slot.id);
  db.prepare(`
    UPDATE bookings SET slot_id = ?, start = ?, duration_min = ?, status = 'pending', updated_at = ? WHERE id = ?`)
    .run(slot.id, slot.start, slot.duration_min, nowIso, booking.id);

  notify(booking.studentId, 'booking_rescheduled', `Специалист предложил другое время: ${fmtServer(slot.start)} — подтвердите в кабинете`);
  res.json({ booking: bookingView(getBooking(booking.id), req.user) });
});

api.post('/bookings/:id/complete', requireAuth, requireRole('specialist'), (req, res) => {
  const booking = getBooking(req.params.id);
  if (!booking) return res.status(404).json({ error: 'Запись не найдена' });
  if (booking.specialistId !== req.user.id) return res.status(403).json({ error: 'Это не ваша запись' });
  if (booking.status !== 'confirmed') return res.status(400).json({ error: 'Провести можно только подтверждённую запись' });

  db.prepare(`UPDATE bookings SET status = 'completed', updated_at = ? WHERE id = ?`)
    .run(new Date().toISOString(), booking.id);
  notify(booking.studentId, 'booking_completed', `Консультация ${fmtServer(booking.start)} завершена`);
  res.json({ booking: bookingView(getBooking(booking.id), req.user) });
});

api.post('/bookings/:id/spec-note', requireAuth, requireRole('specialist'), (req, res) => {
  const booking = getBooking(req.params.id);
  if (!booking) return res.status(404).json({ error: 'Запись не найдена' });
  if (booking.specialistId !== req.user.id) return res.status(403).json({ error: 'Это не ваша запись' });

  db.prepare(`UPDATE bookings SET spec_note = ?, updated_at = ? WHERE id = ?`)
    .run(String((req.body || {}).text || '').trim(), new Date().toISOString(), booking.id);
  res.json({ booking: bookingView(getBooking(booking.id), req.user) });
});

api.get('/my/clients', requireAuth, requireRole('specialist'), (req, res) => {
  const clients = db.prepare(`
    SELECT b.student_id, u.name, COUNT(*) AS visits, MAX(b.start) AS last_start
    FROM bookings b JOIN users u ON u.id = b.student_id
    WHERE b.specialist_id = ? AND b.status != 'cancelled'
    GROUP BY b.student_id ORDER BY last_start DESC`)
    .all(req.user.id)
    .map(({ student_id, name, visits, last_start }) => ({ id: student_id, name, visits, lastStart: last_start }));
  res.json({ clients });
});

/* --- отзывы --- */

api.post('/reviews', requireAuth, requireRole('student'), (req, res) => {
  const { bookingId, rating, text } = req.body || {};

  const booking = getBooking(bookingId);
  if (!booking) return res.status(404).json({ error: 'Запись не найдена' });
  if (booking.studentId !== req.user.id) return res.status(403).json({ error: 'Это не ваша запись' });
  if (booking.status !== 'completed') return res.status(400).json({ error: 'Отзыв можно оставить только после проведённой консультации' });
  if (booking.hasReview) return res.status(400).json({ error: 'Отзыв к этой консультации уже оставлен' });

  const score = Number(rating);
  if (!Number.isInteger(score) || score < 1 || score > 5) return res.status(400).json({ error: 'Оценка — целое число от 1 до 5' });

  const createdAt = new Date().toISOString();
  db.prepare(`
    INSERT INTO reviews (id, booking_id, specialist_id, student_id, rating, text, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(crypto.randomUUID(), booking.id, booking.specialistId, req.user.id, score, String(text || '').trim(), createdAt);
  notify(booking.specialistId, 'review_new', `Новый отзыв: ${score} из 5 о ваших консультациях`);
  res.json({ review: { rating: score, text: String(text || '').trim(), createdAt } });
});

/* --- уведомления --- */

api.get('/notifications', requireAuth, (req, res) => {
  const list = db.prepare(`
    SELECT id, type, text, read, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC`)
    .all(req.user.id)
    .map(({ id, type, text, read, created_at }) => ({ id, type, text, read: !!read, createdAt: created_at }));
  res.json({ notifications: list, unread: list.filter((n) => !n.read).length });
});

api.post('/notifications/read', requireAuth, (req, res) => {
  db.prepare('UPDATE notifications SET read = 1 WHERE user_id = ?').run(req.user.id);
  res.json({ ok: true });
});

api.post('/notifications/:id/read', requireAuth, (req, res) => {
  const result = db.prepare('UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?')
    .run(req.params.id, req.user.id);
  if (!result.changes) return res.status(404).json({ error: 'Уведомление не найдено' });
  res.json({ ok: true });
});

/* --- личный кабинет --- */

api.get('/my/notes', requireAuth, (req, res) => {
  const notes = db.prepare(`
    SELECT id, text, created_at, updated_at FROM notes WHERE user_id = ? ORDER BY updated_at DESC`)
    .all(req.user.id)
    .map(({ id, text, created_at, updated_at }) => ({ id, text, createdAt: created_at, updatedAt: updated_at }));
  res.json({ notes });
});

api.post('/my/notes', requireAuth, (req, res) => {
  const text = String((req.body || {}).text || '').trim();
  if (!text) return res.status(400).json({ error: 'Заметка пустая' });
  if (text.length > 2000) return res.status(400).json({ error: 'Заметка слишком длинная' });

  const id = crypto.randomUUID();
  const nowIso = new Date().toISOString();
  db.prepare('INSERT INTO notes (id, user_id, text, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
    .run(id, req.user.id, text, nowIso, nowIso);
  res.json({ note: { id, text, createdAt: nowIso, updatedAt: nowIso } });
});

api.patch('/my/notes/:id', requireAuth, (req, res) => {
  const text = String((req.body || {}).text || '').trim();
  if (!text) return res.status(400).json({ error: 'Заметка пустая' });

  const result = db.prepare('UPDATE notes SET text = ?, updated_at = ? WHERE id = ? AND user_id = ?')
    .run(text, new Date().toISOString(), req.params.id, req.user.id);
  if (!result.changes) return res.status(404).json({ error: 'Заметка не найдена' });
  res.json({ ok: true });
});

api.delete('/my/notes/:id', requireAuth, (req, res) => {
  const result = db.prepare('DELETE FROM notes WHERE id = ? AND user_id = ?')
    .run(req.params.id, req.user.id);
  if (!result.changes) return res.status(404).json({ error: 'Заметка не найдена' });
  res.json({ ok: true });
});

api.put('/bookings/:id/questionnaire', requireAuth, requireRole('student'), (req, res) => {
  const booking = getBooking(req.params.id);
  if (!booking) return res.status(404).json({ error: 'Запись не найдена' });
  if (booking.studentId !== req.user.id) return res.status(403).json({ error: 'Это не ваша запись' });
  if (booking.status !== 'pending') return res.status(400).json({ error: 'Анкету можно менять, пока заявка не подтверждена' });

  const q = req.body || {};
  const course = String(q.course || '').trim();
  const request = String(q.request || '').trim();
  if (!course || !request) return res.status(400).json({ error: 'Заполните курс и запрос' });

  db.prepare('UPDATE bookings SET questionnaire = ?, updated_at = ? WHERE id = ?')
    .run(JSON.stringify({
      course,
      request,
      experience: String(q.experience || '').trim(),
      notes: String(q.notes || '').trim(),
    }), new Date().toISOString(), booking.id);
  res.json({ ok: true });
});

api.get('/my/stats', requireAuth, (req, res) => {
  if (req.user.role === 'specialist') {
    const consultations = db.prepare(`
      SELECT
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed,
        SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) AS upcoming,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
        COUNT(DISTINCT student_id) AS clients
      FROM bookings WHERE specialist_id = ? AND status != 'cancelled'`)
      .get(req.user.id);
    const rating = db.prepare('SELECT ROUND(COALESCE(AVG(rating), 0) * 10) / 10 AS rating, COUNT(*) AS reviews FROM reviews WHERE specialist_id = ?')
      .get(req.user.id);
    return res.json({
      stats: {
        completed: consultations.completed || 0,
        upcoming: consultations.upcoming || 0,
        pending: consultations.pending || 0,
        clients: consultations.clients || 0,
        rating: rating.rating,
        reviews: rating.reviews,
      },
    });
  }

  const bookings = db.prepare(`
    SELECT
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed,
      SUM(CASE WHEN status IN ('pending', 'confirmed') THEN 1 ELSE 0 END) AS upcoming,
      COUNT(DISTINCT specialist_id) AS specialists
    FROM bookings WHERE student_id = ? AND status != 'cancelled'`)
    .get(req.user.id);
  const reviewsLeft = db.prepare('SELECT COUNT(*) AS n FROM reviews WHERE student_id = ?').get(req.user.id).n;
  res.json({
    stats: {
      completed: bookings.completed || 0,
      upcoming: bookings.upcoming || 0,
      specialists: bookings.specialists || 0,
      reviewsLeft,
    },
  });
});
