import { api } from '../api.js';
import { esc, stars, plural, fmtDate, fmtTime, fmtDateTime, toast } from '../ui.js';
import { state } from '../state.js';
import { openBookingModal } from './booking.js';

const FORMAT_LABELS = { online: 'Онлайн', offline: 'Очно' };

export async function renderSpecialist(container, params, id) {
  container.innerHTML = '<p class="form-hint">Загружаю…</p>';

  let specialist;
  let slots;
  let reviews;
  try {
    [{ specialist }, { slots }, { reviews }] = await Promise.all([
      api(`/specialists/${id}`),
      api(`/specialists/${id}/slots`),
      api(`/specialists/${id}/reviews`),
    ]);
  } catch {
    container.innerHTML = '<section class="card"><h2>Специалист не найден</h2><p><a href="#/catalog">В каталог</a></p></section>';
    return;
  }

  const byDay = new Map();
  for (const slot of slots) {
    const day = fmtDate(slot.start);
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day).push(slot);
  }

  const slotRows = [...byDay].map(([day, daySlots]) => `
    <div class="slot-day">
      <h3>${esc(day)}</h3>
      <div class="slot-chips">${daySlots.map((s) => `<button class="slot-chip" data-id="${s.id}" data-start="${s.start}">${fmtTime(s.start)}</button>`).join('')}</div>
    </div>`).join('');

  container.innerHTML = `
    <a class="back-link" href="#/catalog">← В каталог</a>
    <section class="card spec-head">
      <span class="spec-head__avatar">${esc(specialist.name[0])}</span>
      <div>
        <h1>${esc(specialist.name)}</h1>
        <p class="spec-head__type">${esc(specialist.typeLabel)} · ${esc(specialist.specialization)}</p>
        <p class="spec-head__meta">
          <span class="rating">${stars(specialist.rating)} <b>${specialist.reviewsCount ? specialist.rating.toFixed(1) : '—'}</b></span>
          <span class="spec-head__count">${specialist.reviewsCount ? `${specialist.reviewsCount} ${plural(specialist.reviewsCount, ['отзыв', 'отзыва', 'отзывов'])}` : 'отзывов пока нет'}</span>
          ${specialist.formats.map((f) => `<span class="badge">${FORMAT_LABELS[f]}</span>`).join('')}
        </p>
        <p class="spec-head__bio">${esc(specialist.bio)}</p>
      </div>
    </section>
    <section class="card" id="slots-section">
      <h2>Свободное время</h2>
      ${slotRows || '<p class="form-hint">Свободных слотов пока нет.</p>'}
      <p class="form-hint">Приём: с ${specialist.workFrom}:00 до ${specialist.workTo}:00, консультация — 50 минут.</p>
    </section>
    <section class="card">
      <h2>Отзывы</h2>
      ${reviews.length
        ? reviews.map((r) => `
          <div class="review">
            <div class="review__head">
              <span class="rating">${stars(r.rating)}</span>
              <span class="review__date">${fmtDateTime(r.createdAt)}</span>
            </div>
            <p class="review__text">${esc(r.text)}</p>
          </div>`).join('')
        : '<p class="form-hint">Отзывов пока нет — они появляются после проведённых консультаций.</p>'}
      <p class="form-hint">Все отзывы публикуются анонимно.</p>
    </section>`;

  container.querySelector('#slots-section').addEventListener('click', (event) => {
    const chip = event.target.closest('.slot-chip');
    if (!chip) return;
    if (!state.me) {
      toast('Войдите, чтобы записаться', 'error');
      location.hash = '#/login';
      return;
    }
    if (state.me.role === 'specialist') {
      toast('Запись доступна только студентам', 'error');
      return;
    }
    openBookingModal({ id: chip.dataset.id, start: chip.dataset.start }, specialist);
  });
}
