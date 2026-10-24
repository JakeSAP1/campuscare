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

export const CONSULTATION_TYPES = {
  psychologist: 'Психолог',
  career: 'Карьерный консультант',
  tutor: 'Тьютор',
};

export function buildSeed() {
  const now = new Date();
  const passHash = hashPassword('demo1234');

  const specialist = (over) => ({
    id: randomUUID(),
    role: 'specialist',
    passHash,
    createdAt: iso(now),
    type: 'psychologist',
    specialization: '',
    bio: '',
    formats: ['online', 'offline'],
    workFrom: 10,
    workTo: 17,
    ...over,
  });

  const student = (over) => ({
    id: randomUUID(),
    role: 'student',
    passHash,
    createdAt: iso(now),
    ...over,
  });

  const specialists = [
    specialist({
      name: 'Марина Крылова',
      email: 'psychologist@campuscare.ru',
      type: 'psychologist',
      specialization: 'Тревога, стресс, адаптация к вузу',
      bio: 'Кандидат психологических наук, 8 лет консультирует студентов. Работаю с тревогой перед экзаменами, страхом выступлений и трудностями первого курса.',
      workFrom: 10,
      workTo: 17,
    }),
    specialist({
      name: 'Игорь Дементьев',
      email: 'i.dementiev@campuscare.ru',
      type: 'psychologist',
      specialization: 'Отношения, самооценка, выгорание',
      bio: 'Практикующий психолог, гештальт-подход. Помогаю разобраться в отношениях, восстановить силы и вернуть интерес к учёбе.',
      formats: ['online'],
      workFrom: 12,
      workTo: 19,
    }),
    specialist({
      name: 'Ольга Санина',
      email: 'o.sanina@campuscare.ru',
      type: 'career',
      specialization: 'Профориентация и первое трудоустройство',
      bio: 'Карьерный консультант центра карьеры. Помогаю выбрать направление, собрать первое резюме и не бояться собеседований.',
      workFrom: 9,
      workTo: 15,
    }),
    specialist({
      name: 'Павел Гущин',
      email: 'p.gushchin@campuscare.ru',
      type: 'career',
      specialization: 'Резюме, собеседования, стажировки',
      bio: 'Руководил наймом в IT-компании 6 лет. Разбираем резюме по строчкам, тренируем собеседования и выбираем стажировки.',
      workFrom: 14,
      workTo: 20,
    }),
    specialist({
      name: 'Анна Верещагина',
      email: 'a.vereshchagina@campuscare.ru',
      type: 'tutor',
      specialization: 'Организация учёбы и учебные стратегии',
      bio: 'Университетский тьютор. Составляем реалистичный учебный план, наводим порядок в дедлайнах и конспектах.',
      workFrom: 10,
      workTo: 18,
    }),
    specialist({
      name: 'Тимур Аслаханов',
      email: 't.aslakhanov@campuscare.ru',
      type: 'tutor',
      specialization: 'Академическая задолженность и планирование',
      bio: 'Тьютор для тех, у кого накопились долги по дисциплинам. Разберём ситуацию без паники и распишем план закрытия задолженностей.',
      formats: ['online'],
      workFrom: 11,
      workTo: 17,
    }),
  ];

  const students = [
    student({ name: 'Алина Сафина', email: 'student@campuscare.ru' }),
    student({ name: 'Егор Лапшин', email: 'egor@example.ru' }),
    student({ name: 'Дина Хайруллина', email: 'dina@example.ru' }),
    student({ name: 'Марк Осипов', email: 'mark@example.ru' }),
    student({ name: 'Настя Ким', email: 'nastya@example.ru' }),
  ];

  const [alina, egor, dina, mark, nastya] = students;

  const slots = [];
  const addSlots = (spec) => {
    for (let day = 1; day <= 14; day += 1) {
      const date = at(day, 12);
      if (date.getDay() === 0) continue;
      for (let hour = spec.workFrom; hour < spec.workTo; hour += 1) {
        const start = at(day, hour);
        slots.push({
          id: randomUUID(),
          specialistId: spec.id,
          start: iso(start),
          durationMin: SLOT_MIN,
          status: 'free',
        });
      }
    }
  };
  specialists.forEach(addSlots);

  const bookings = [];
  const reviews = [];

  const pastBooking = (studentUser, spec, dayOffset, hour, rating, text) => {
    const start = at(dayOffset, hour);
    const booking = {
      id: randomUUID(),
      studentId: studentUser.id,
      specialistId: spec.id,
      slotId: null,
      start: iso(start),
      durationMin: SLOT_MIN,
      format: spec.formats.includes('offline') ? 'offline' : 'online',
      status: 'completed',
      questionnaire: null,
      specNote: '',
      studentNote: '',
      reminderSent: true,
      createdAt: iso(new Date(start.getTime() - 3 * DAY)),
      updatedAt: iso(start),
    };
    bookings.push(booking);
    if (rating) {
      reviews.push({
        id: randomUUID(),
        bookingId: booking.id,
        specialistId: spec.id,
        studentId: studentUser.id,
        rating,
        text,
        createdAt: iso(new Date(start.getTime() + 2 * DAY)),
      });
    }
    return booking;
  };

  pastBooking(egor, specialists[0], -21, 11, 5, 'Пришла с паникой перед сессией, ушла с планом подготовки. Спокойно и по делу.');
  pastBooking(dina, specialists[0], -14, 15, 5, 'Впервые решилась поговорить с психологом — нисколько не жалею. Атмосфера безопасная.');
  pastBooking(mark, specialists[0], -6, 12, 4, 'Полезно, хотя часть советов пришлось перечитывать в конспекте после разговора.');
  pastBooking(nastya, specialists[1], -18, 13, 5, 'Точная и бережная работа. Стало понятнее, откуда берётся выгорание.');
  pastBooking(mark, specialists[1], -9, 14, 4, 'Разговор по существу, без волшебства, но дышать стало легче.');
  pastBooking(egor, specialists[2], -12, 10, 5, 'Помогли увидеть, что мне на самом деле интересно. Составили план на семестр.');
  pastBooking(nastya, specialists[2], -5, 9, 4, 'Разобрали резюме, указали на слабые формулировки. Жаль, что приём только до трёх.');
  pastBooking(dina, specialists[3], -15, 15, 5, 'Тренировали собеседование почти час. После него реальное интервью прошло спокойнее.');
  pastBooking(egor, specialists[3], -8, 16, 4, 'Конкретика по стажировкам, без воды.');
  pastBooking(mark, specialists[4], -20, 11, 5, 'Наконец навели порядок в дедлайнах. План на неделю реально работает.');
  pastBooking(nastya, specialists[4], -11, 16, 4, 'Хорошие учебные стратегии, часть уже применяю.');
  pastBooking(dina, specialists[5], -10, 12, 5, 'Долги по двум предметам казались концом света. Расписали на недели — уже закрыла один.');
  pastBooking(alina, specialists[5], -4, 13, 4, 'Спокойно и без осуждения объяснили, как договариваться с преподавателями.');

  const egorPendingStart = at(1, specialists[0].workFrom + 2);
  const egorPendingSlot = slots.find((slot) => slot.specialistId === specialists[0].id && slot.start === iso(egorPendingStart));
  if (egorPendingSlot) {
    egorPendingSlot.status = 'booked';
    bookings.push({
      id: randomUUID(),
      studentId: egor.id,
      specialistId: specialists[0].id,
      slotId: egorPendingSlot.id,
      start: iso(egorPendingStart),
      durationMin: SLOT_MIN,
      format: 'online',
      status: 'pending',
      questionnaire: {
        course: '2 курс',
        request: 'Постоянно откладываю подготовку к экзаменам, начинается паника за неделю до сессии.',
        experience: 'Обращался в прошлом месяце, помогло.',
        notes: 'Удобнее вечером или в среду днём.',
      },
      specNote: '',
      studentNote: '',
      reminderSent: false,
      createdAt: iso(now),
      updatedAt: iso(now),
    });
  }

  const alinaConfirmedStart = at(2, specialists[0].workFrom + 3);
  const alinaSlot = slots.find((slot) => slot.specialistId === specialists[0].id && slot.start === iso(alinaConfirmedStart));
  if (alinaSlot) {
    alinaSlot.status = 'booked';
    bookings.push({
      id: randomUUID(),
      studentId: alina.id,
      specialistId: specialists[0].id,
      slotId: alinaSlot.id,
      start: iso(alinaConfirmedStart),
      durationMin: SLOT_MIN,
      format: 'offline',
      status: 'confirmed',
      questionnaire: {
        course: '3 курс',
        request: 'Сложно адаптироваться после больничного, отстала по двум дисциплинам и тревожусь из-за этого.',
        experience: 'Первая консультация.',
        notes: '',
      },
      specNote: 'Договорились про режим сна и пошаговый план по отставшим дисциплинам.',
      studentNote: 'Взять с собой распечатку ведомости.',
      reminderSent: false,
      createdAt: iso(new Date(now.getTime() - 2 * DAY)),
      updatedAt: iso(new Date(now.getTime() - 1 * DAY)),
    });
  }

  return {
    users: [...specialists, ...students],
    slots,
    bookings,
    reviews,
    notifications: [],
    sessions: [],
  };
}
