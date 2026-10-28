import { api } from '../api.js';
import { esc, plural, fmtDate, fmtTime, toast, openModal, STATUS_INFO, FORMAT_LABELS } from '../ui.js';
import { state } from '../state.js';

const actions = (booking) => `
  <div class="booking-card__actions">
    ${booking.status === 'pending' ? '<button class="btn btn--sm" data-action="confirm">Подтвердить</button><button class="btn btn--ghost btn--sm" data-action="reschedule">Перенести</button>' : ''}
    ${booking.status === 'confirmed' ? '<button class="btn btn--sm" data-action="complete">Отметить проведённой</button><button class="btn btn--ghost btn--sm" data-action="reschedule">Перенести</button>' : ''}
    ${['pending', 'confirmed'].includes(booking.status) ? '<button class="btn btn--ghost btn--sm" data-action="cancel">Отменить</button>' : ''}
  </div>`;

const questionnaireBlock = (q) => (q ? `
  <details class="q-details">
    <summary>Анкета студента</summary>
    <dl>
      <div><dt>Курс</dt><dd>${esc(q.course)}</dd></div>
      <div><dt>Запрос</dt><dd>${esc(q.request)}</dd></div>
      <div><dt>Опыт</dt><dd>${esc(q.experience || 'не указан')}</dd></div>
      ${q.notes ? `<div><dt>Дополнительно</dt><dd>${esc(q.notes)}</dd></div>` : ''}
    </dl>
  </details>` : '');

const noteBlock = (booking) => (['confirmed', 'completed'].includes(booking.status) ? `
  <div class="note-block">
    <textarea rows="2" placeholder="Заметка по консультации — видна только вам" data-note>${esc(booking.specNote || '')}</textarea>
    <button class="btn btn--ghost btn--sm" data-action="note">Сохранить заметку</button>
  </div>` : '');

const scheduleCard = (booking) => `
  <div class="booking-card" data-id="${booking.id}">
    <div class="booking-card__head">
      <div>
        <div class="booking-card__when">${fmtDate(booking.start)}, ${fmtTime(booking.start)} · ${FORMAT_LABELS[booking.format]}</div>
        <div class="booking-card__who">${esc(booking.student.name)}</div>
      </div>
      <span class="status ${STATUS_INFO[booking.status].cls}">${STATUS_INFO[booking.status].label}</span>
    </div>
    ${booking.status === 'cancelled' && booking.cancelReason ? `<p class="booking-card__reason">Причина: ${esc(booking.cancelReason)}</p>` : ''}
    ${questionnaireBlock(booking.questionnaire)}
    ${noteBlock(booking)}
    ${actions(booking)}
  </div>`;

const rescheduleModal = async (booking, rerender) => {
  let slots;
  try {
    ({ slots } = await api(`/specialists/${state.me.id}/slots`));
  } catch {
    toast('Не удалось загрузить свободное время', 'error');
    return;
  }

  const byDay = new Map();
  for (const slot of slots) {
    const day = fmtDate(slot.start);
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day).push(slot);
  }

  const { overlay, close } = openModal(`
    <h2>Новое время</h2>
    <p class="modal__meta">${esc(booking.student.name)} — сейчас ${fmtDate(booking.start)}, ${fmtTime(booking.start)}. Предложите свободный слот.</p>
    <div class="slot-picker">${[...byDay].map(([day, daySlots]) => `
      <div class="slot-day">
        <h3>${esc(day)}</h3>
        <div class="slot-chips">${daySlots.map((s) => `<button class="slot-chip" data-id="${s.id}">${fmtTime(s.start)}</button>`).join('')}</div>
      </div>`).join('') || '<p class="form-hint">Свободных слотов нет.</p>'}</div>`);

  overlay.querySelector('.slot-picker').addEventListener('click', async (event) => {
    const chip = event.target.closest('.slot-chip');
    if (!chip) return;
    try {
      await api(`/bookings/${booking.id}/reschedule`, { method: 'POST', body: { slotId: chip.dataset.id } });
      close();
      toast('Время предложено — студент должен подтвердить', 'success');
      rerender();
    } catch (err) {
      toast(err.message, 'error');
    }
  });
};

export async function renderSchedule(container) {
  container.innerHTML = '<p class="form-hint">Загружаю…</p>';

  let bookings;
  let clients;
  try {
    [{ bookings }, { clients }] = await Promise.all([api('/my/schedule'), api('/my/clients')]);
  } catch {
    container.innerHTML = '<p class="form-error">Не удалось загрузить расписание. Попробуйте обновить страницу.</p>';
    return;
  }

  const requests = bookings.filter((b) => b.status === 'pending');
  const upcoming = bookings.filter((b) => b.status === 'confirmed');
  const archive = bookings.filter((b) => ['completed', 'cancelled'].includes(b.status)).reverse();

  container.innerHTML = `
    <h1 class="page-title">Расписание</h1>
    <div id="schedule-root">
      <h2 class="section-title">Заявки — требуют решения</h2>
      <div>${requests.length ? requests.map(scheduleCard).join('') : '<p class="form-hint">Новых заявок нет.</p>'}</div>
      <h2 class="section-title">Подтверждённые</h2>
      <div>${upcoming.length ? upcoming.map(scheduleCard).join('') : '<p class="form-hint">Подтверждённых консультаций нет.</p>'}</div>
      <h2 class="section-title">Архив</h2>
      <div>${archive.length ? archive.map(scheduleCard).join('') : '<p class="form-hint">Здесь будут проведённые и отменённые консультации.</p>'}</div>
      <h2 class="section-title">Клиенты</h2>
      <div class="clients">${clients.length ? clients.map((c) => `
        <div class="client-row">
          <span class="client-row__name">${esc(c.name)}</span>
          <span class="client-row__meta">${c.visits} ${plural(c.visits, ['визит', 'визита', 'визитов'])} · последний: ${fmtDate(c.lastStart)}</span>
        </div>`).join('') : '<p class="form-hint">Пока никто не записывался.</p>'}</div>
    </div>`;

  const rerender = () => renderSchedule(container);

  container.querySelector('#schedule-root').addEventListener('click', async (event) => {
    const btn = event.target.closest('[data-action]');
    if (!btn) return;
    const card = btn.closest('.booking-card');
    const id = card.dataset.id;
    const action = btn.dataset.action;

    if (action === 'note') {
      try {
        await api(`/bookings/${id}/spec-note`, { method: 'POST', body: { text: card.querySelector('[data-note]').value } });
        toast('Заметка сохранена', 'success');
      } catch (err) {
        toast(err.message, 'error');
      }
      return;
    }

    if (action === 'reschedule') {
      const booking = bookings.find((b) => b.id === id);
      rescheduleModal(booking, rerender);
      return;
    }

    try {
      await api(`/bookings/${id}/${action}`, { method: 'POST', body: {} });
      toast(action === 'confirm' ? 'Запись подтверждена' : action === 'complete' ? 'Отмечено как проведённая' : 'Запись отменена', 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
    rerender();
  });
}
