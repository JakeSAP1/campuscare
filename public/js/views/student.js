import { api } from '../api.js';
import { esc, plural, fmtDate, fmtTime, fmtRelativeDay, toast, STATUS_INFO, FORMAT_LABELS } from '../ui.js';
import { openReviewModal } from './review.js';
import { openQuestionnaireModal } from './booking.js';
import { renderProfileTab } from './profile.js';
import { renderNotesTab } from './notes.js';

const TABS = [
  ['consultations', 'Консультации'],
  ['notes', 'Заметки'],
  ['profile', 'Профиль'],
];

const questionnaireBlock = (booking) => (booking.questionnaire ? `
  <details class="q-details">
    <summary>Моя анкета</summary>
    <dl>
      <div><dt>Курс</dt><dd>${esc(booking.questionnaire.course)}</dd></div>
      <div><dt>Запрос</dt><dd>${esc(booking.questionnaire.request)}</dd></div>
      <div><dt>Опыт</dt><dd>${esc(booking.questionnaire.experience || 'не указан')}</dd></div>
      ${booking.questionnaire.notes ? `<div><dt>Дополнительно</dt><dd>${esc(booking.questionnaire.notes)}</dd></div>` : ''}
    </dl>
    ${booking.status === 'pending' ? '<button class="btn btn--ghost btn--sm" data-action="edit-questionnaire">Изменить анкету</button>' : ''}
  </details>` : '');

const bookingCard = (booking, isUpcoming) => `
  <div class="booking-card" data-id="${booking.id}">
    <div class="booking-card__head">
      <div>
        <div class="booking-card__when">${fmtDate(booking.start)}, ${fmtTime(booking.start)} · ${FORMAT_LABELS[booking.format]}</div>
        <div class="booking-card__who"><a href="#/specialist/${booking.specialist.id}">${esc(booking.specialist.name)}</a> · ${esc(booking.specialist.typeLabel)}</div>
      </div>
      <span class="status ${STATUS_INFO[booking.status].cls}">${STATUS_INFO[booking.status].label}</span>
    </div>
    ${booking.status === 'cancelled' && booking.cancelReason ? `<p class="booking-card__reason">Причина: ${esc(booking.cancelReason)}</p>` : ''}
    ${booking.status === 'pending' ? questionnaireBlock(booking) : ''}
    <div class="booking-card__actions">
      ${booking.status === 'pending' ? '<button class="btn btn--sm" data-action="confirm">Подтвердить</button>' : ''}
      ${isUpcoming ? '<button class="btn btn--ghost btn--sm" data-action="cancel">Отменить</button>' : ''}
      ${booking.canReview ? '<button class="btn btn--sm" data-action="review">Оставить отзыв</button>' : ''}
      ${booking.status === 'completed' ? `<a class="btn btn--ghost btn--sm" href="#/specialist/${booking.specialist.id}">Записаться снова</a>` : ''}
    </div>
  </div>`;

const statsStrip = (stats) => `
  <div class="stats-strip">
    <div class="stat-card"><b>${stats.upcoming}</b><span>${plural(stats.upcoming, ['предстоящая', 'предстоящие', 'предстоящих'])}</span></div>
    <div class="stat-card"><b>${stats.completed}</b><span>${plural(stats.completed, ['проведена', 'проведены', 'проведено'])}</span></div>
    <div class="stat-card"><b>${stats.specialists}</b><span>${plural(stats.specialists, ['специалист', 'специалиста', 'специалистов'])}</span></div>
    <div class="stat-card"><b>${stats.reviewsLeft}</b><span>${plural(stats.reviewsLeft, ['отзыв', 'отзыва', 'отзывов'])} оставлено</span></div>
  </div>`;

export async function renderCabinet(container, params, _match, tab = 'consultations') {
  container.innerHTML = '<p class="form-hint">Загружаю…</p>';

  let bookings;
  let stats;
  try {
    [{ bookings }, { stats }] = await Promise.all([api('/my/bookings'), api('/my/stats')]);
  } catch {
    container.innerHTML = '<p class="form-error">Не удалось загрузить кабинет. Попробуйте обновить страницу.</p>';
    return;
  }

  const upcoming = bookings
    .filter((b) => ['pending', 'confirmed'].includes(b.status))
    .sort((a, b) => new Date(a.start) - new Date(b.start));
  const history = bookings.filter((b) => ['completed', 'cancelled'].includes(b.status));
  const soonest = upcoming.find((b) => b.status === 'confirmed' && new Date(b.start).getTime() - Date.now() <= 24 * 60 * 60 * 1000);

  container.innerHTML = `
    <div class="page-head">
      <h1 class="page-title">Личный кабинет</h1>
      <a class="btn btn--sm" href="#/catalog">Новая запись</a>
    </div>
    ${soonest ? `
      <div class="reminder-banner">
        ⏰ Консультация с ${esc(soonest.specialist.name)} — ${fmtRelativeDay(soonest.start)} в ${fmtTime(soonest.start)}
        (${FORMAT_LABELS[soonest.format]})
      </div>` : ''}
    <div id="cabinet-shell">
      <div class="tabs">${TABS.map(([id, label]) => `<button class="tab ${id === tab ? 'tab--active' : ''}" data-tab="${id}">${label}</button>`).join('')}</div>
      <div id="tab-body"></div>
    </div>`;

  const body = container.querySelector('#tab-body');
  const rerender = () => renderCabinet(container, params, _match, tab);

  container.querySelector('#cabinet-shell').addEventListener('click', (event) => {
    const tabBtn = event.target.closest('[data-tab]');
    if (!tabBtn || tabBtn.dataset.tab === tab) return;
    renderCabinet(container, params, _match, tabBtn.dataset.tab);
  });

  if (tab === 'notes') {
    renderNotesTab(body);
    return;
  }
  if (tab === 'profile') {
    renderProfileTab(body);
    return;
  }

  body.innerHTML = `
    <div id="cabinet-root">
      ${statsStrip(stats)}
      <h2 class="section-title">Предстоящие</h2>
      <div>${upcoming.length
        ? upcoming.map((b) => bookingCard(b, true)).join('')
        : '<p class="form-hint">Предстоящих консультаций нет — <a href="#/catalog">выберите специалиста</a>.</p>'}</div>
      <h2 class="section-title">История</h2>
      <div>${history.length
        ? history.map((b) => bookingCard(b, false)).join('')
        : '<p class="form-hint">Здесь появятся проведённые и отменённые консультации.</p>'}</div>
    </div>`;

  body.querySelector('#cabinet-root').addEventListener('click', async (event) => {
    const btn = event.target.closest('[data-action]');
    if (!btn) return;
    const card = btn.closest('.booking-card');
    const booking = [...upcoming, ...history].find((b) => b.id === card.dataset.id);

    if (btn.dataset.action === 'review') {
      openReviewModal(booking, () => rerender());
      return;
    }
    if (btn.dataset.action === 'edit-questionnaire') {
      openQuestionnaireModal(booking, () => rerender());
      return;
    }

    try {
      await api(`/bookings/${card.dataset.id}/${btn.dataset.action}`, { method: 'POST', body: {} });
      toast(btn.dataset.action === 'confirm' ? 'Запись подтверждена' : 'Запись отменена', 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
    rerender();
  });
}
