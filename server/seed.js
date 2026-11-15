import { randomUUID } from 'node:crypto';
import { hashPassword } from './passwords.js';

const DAY = 24 * 60 * 60 * 1000;
const SLOT_MIN = 50;

const iso = (date) => date.toISOString();

function at(dayOffset, hour) {
  const date = new Date(Date.now() + dayOffset * DAY);
  date.setHours(hour, 0, 0, 0);
  return date;
}

const SPECIALISTS = [
  {
    name: 'Марина Крылова',
    email: 'psychologist@campuscare.ru',
    type: 'psychologist',
    specialization: 'Тревога, стресс, адаптация к вузу',
    bio: 'Кандидат психологических наук, 8 лет консультирует студентов. Работаю с тревогой перед экзаменами, страхом выступлений и трудностями первого курса.',
    formats: ['online', 'offline'],
    workFrom: 10,
    workTo: 17,
  },
  {
    name: 'Игорь Дементьев',
    email: 'i.dementiev@campuscare.ru',
    type: 'psychologist',
    specialization: 'Отношения, самооценка, выгорание',
    bio: 'Практикующий психолог, гештальт-подход. Помогаю разобраться в отношениях, восстановить силы и вернуть интерес к учёбе.',
    formats: ['online'],
    workFrom: 12,
    workTo: 19,
  },
  {
    name: 'Ольга Санина',
    email: 'o.sanina@campuscare.ru',
    type: 'career',
    specialization: 'Профориентация и первое трудоустройство',
    bio: 'Карьерный консультант центра карьеры. Помогаю выбрать направление, собрать первое резюме и не бояться собеседований.',
    formats: ['online', 'offline'],
    workFrom: 9,
    workTo: 15,
  },
  {
    name: 'Павел Гущин',
    email: 'p.gushchin@campuscare.ru',
    type: 'career',
    specialization: 'Резюме, собеседования, стажировки',
    bio: 'Руководил наймом в IT-компании 6 лет. Разбираем резюме по строчкам, тренируем собеседования и выбираем стажировки.',
    formats: ['online', 'offline'],
    workFrom: 14,
    workTo: 20,
  },
  {
    name: 'Анна Верещагина',
    email: 'a.vereshchagina@campuscare.ru',
    type: 'tutor',
    specialization: 'Организация учёбы и учебные стратегии',
    bio: 'Университетский тьютор. Составляем реалистичный учебный план, наводим порядок в дедлайнах и конспектах.',
    formats: ['online', 'offline'],
    workFrom: 10,
    workTo: 18,
  },
  {
    name: 'Тимур Аслаханов',
    email: 't.aslakhanov@campuscare.ru',
    type: 'tutor',
    specialization: 'Академическая задолженность и планирование',
    bio: 'Тьютор для тех, у кого накопились долги по дисциплинам. Разберём ситуацию без паники и распишем план закрытия задолженностей.',
    formats: ['online'],
    workFrom: 11,
    workTo: 17,
  },
];

const STUDENTS = [
  { name: 'Алина Сафина', email: 'student@campuscare.ru' },
  { name: 'Егор Лапшин', email: 'egor@example.ru' },
  { name: 'Дина Хайруллина', email: 'dina@example.ru' },
  { name: 'Марк Осипов', email: 'mark@example.ru' },
  { name: 'Настя Ким', email: 'nastya@example.ru' },
];

const PAST_CONSULTATIONS = [
  ['Егор Лапшин', 'Марина Крылова', -21, 11, 5, 'Пришла с паникой перед сессией, ушла с планом подготовки. Спокойно и по делу.'],
  ['Дина Хайруллина', 'Марина Крылова', -14, 15, 5, 'Впервые решилась поговорить с психологом — нисколько не жалею. Атмосфера безопасная.'],
  ['Марк Осипов', 'Марина Крылова', -6, 12, 4, 'Полезно, хотя часть советов пришлось перечитывать в конспекте после разговора.'],
  ['Настя Ким', 'Игорь Дементьев', -18, 13, 5, 'Точная и бережная работа. Стало понятнее, откуда берётся выгорание.'],
  ['Марк Осипов', 'Игорь Дементьев', -9, 14, 4, 'Разговор по существу, без волшебства, но дышать стало легче.'],
  ['Егор Лапшин', 'Ольга Санина', -12, 10, 5, 'Помогли увидеть, что мне на самом деле интересно. Составили план на семестр.'],
  ['Настя Ким', 'Ольга Санина', -5, 9, 4, 'Разобрали резюме, указали на слабые формулировки. Жаль, что приём только до трёх.'],
  ['Дина Хайруллина', 'Павел Гущин', -15, 15, 5, 'Тренировали собеседование почти час. После него реальное интервью прошло спокойнее.'],
  ['Егор Лапшин', 'Павел Гущин', -8, 16, 4, 'Конкретика по стажировкам, без воды.'],
  ['Марк Осипов', 'Анна Верещагина', -20, 11, 5, 'Наконец навели порядок в дедлайнах. План на неделю реально работает.'],
  ['Настя Ким', 'Анна Верещагина', -11, 16, 4, 'Хорошие учебные стратегии, часть уже применяю.'],
  ['Дина Хайруллина', 'Тимур Аслаханов', -10, 12, 5, 'Долги по двум предметам казались концом света. Расписали на недели — уже закрыла один.'],
  ['Алина Сафина', 'Тимур Аслаханов', -4, 13, 4, 'Спокойно и без осуждения объяснили, как договариваться с преподавателями.'],
];

export function seedIfEmpty(db) {
  const count = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
  if (count > 0) return;

  const now = new Date();
  const passHash = hashPassword('demo1234');
  const insertUser = db.prepare(`
    INSERT INTO users (id, role, name, email, pass_hash, type, specialization, bio, formats, work_from, work_to, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

  const users = new Map();
  for (const spec of SPECIALISTS) {
    const id = randomUUID();
    users.set(spec.name, { id, ...spec });
    insertUser.run(
      id, 'specialist', spec.name, spec.email, passHash,
      spec.type, spec.specialization, spec.bio,
      JSON.stringify(spec.formats), spec.workFrom, spec.workTo, iso(now),
    );
  }
  for (const student of STUDENTS) {
    const id = randomUUID();
    users.set(student.name, { id, ...student });
    insertUser.run(id, 'student', student.name, student.email, passHash, null, '', '', '["online"]', 10, 18, iso(now));
  }

  const insertSlot = db.prepare('INSERT INTO slots (id, specialist_id, start, duration_min, status) VALUES (?, ?, ?, ?, ?)');
  for (const spec of SPECIALISTS) {
    const specId = users.get(spec.name).id;
    for (let day = 1; day <= 14; day += 1) {
      if (at(day, 12).getDay() === 0) continue;
      for (let hour = spec.workFrom; hour < spec.workTo; hour += 1) {
        insertSlot.run(randomUUID(), specId, iso(at(day, hour)), SLOT_MIN, 'free');
      }
    }
  }

  const insertBooking = db.prepare(`
    INSERT INTO bookings (id, student_id, specialist_id, slot_id, start, duration_min, format, status,
      questionnaire, spec_note, student_note, cancel_reason, reminder_sent, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const insertReview = db.prepare(`
    INSERT INTO reviews (id, booking_id, specialist_id, student_id, rating, text, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)`);
  const bookSlot = db.prepare(`UPDATE slots SET status = 'booked' WHERE id = ? AND start = ?`);

  for (const [studentName, specName, dayOffset, hour, rating, text] of PAST_CONSULTATIONS) {
    const studentId = users.get(studentName).id;
    const spec = users.get(specName);
    const start = at(dayOffset, hour);
    const bookingId = randomUUID();
    insertBooking.run(
      bookingId, studentId, spec.id, null, iso(start), SLOT_MIN,
      spec.formats.includes('offline') ? 'offline' : 'online', 'completed',
      null, '', '', '', 1,
      iso(new Date(start.getTime() - 3 * DAY)), iso(start),
    );
    if (rating) {
      insertReview.run(randomUUID(), bookingId, spec.id, studentId, rating, text, iso(new Date(start.getTime() + 2 * DAY)));
    }
  }

  const marina = users.get('Марина Крылова');
  const egorId = users.get('Егор Лапшин').id;

  const egorSlotStart = iso(at(1, marina.workFrom + 2));
  const egorSlot = db.prepare(`SELECT id FROM slots WHERE specialist_id = ? AND start = ?`).get(marina.id, egorSlotStart);
  if (egorSlot) {
    bookSlot.run(egorSlot.id, egorSlotStart);
    insertBooking.run(
      randomUUID(), egorId, marina.id, egorSlot.id, egorSlotStart, SLOT_MIN, 'online', 'pending',
      JSON.stringify({
        course: '2 курс',
        request: 'Постоянно откладываю подготовку к экзаменам, начинается паника за неделю до сессии.',
        experience: 'Обращался в прошлом месяце, помогло.',
        notes: 'Удобнее вечером или в среду днём.',
      }), '', '', '', 0, iso(now), iso(now),
    );
  }

  const alinaId = users.get('Алина Сафина').id;
  const alinaSlotStart = iso(at(2, marina.workFrom + 3));
  const alinaSlot = db.prepare(`SELECT id FROM slots WHERE specialist_id = ? AND start = ?`).get(marina.id, alinaSlotStart);
  if (alinaSlot) {
    bookSlot.run(alinaSlot.id, alinaSlotStart);
    insertBooking.run(
      randomUUID(), alinaId, marina.id, alinaSlot.id, alinaSlotStart, SLOT_MIN, 'offline', 'confirmed',
      JSON.stringify({
        course: '3 курс',
        request: 'Сложно адаптироваться после больничного, отстала по двум дисциплинам и тревожусь из-за этого.',
        experience: 'Первая консультация.',
        notes: '',
      }),
      'Договорились про режим сна и пошаговый план по отставшим дисциплинам.',
      'Взять с собой распечатку ведомости.', '', 0,
      iso(new Date(now.getTime() - 2 * DAY)), iso(new Date(now.getTime() - 1 * DAY)),
    );
  }
}
