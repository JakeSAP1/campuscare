import { api } from '../api.js';
import { esc, fmtDate, fmtTime, toast, STATUS_INFO, FORMAT_LABELS } from '../ui.js';

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
    <div class="booking-card__actions">
      ${booking.status === 'pending' ? '<button class="btn btn--sm" data-action="confirm">Подтвердить</button>' : ''}
      ${isUpcoming ? '<button class="btn btn--ghost btn--sm" data-action="cancel">Отменить</button>' : ''}
      ${booking.status === 'completed' ? `<a class="btn btn--ghost btn--sm" href="#/specialist/${booking.specialist.id}">Записаться снова</a>` : ''}
    </div>
  </div>`;

export async function renderCabinet(container) {
  container.innerHTML = '<p class="form-hint">Загружаю…</p>';

  let bookings;
  try {
    ({ bookings } = await api('/my/bookings'));
  } catch {
    container.innerHTML = '<p class="form-error">Не удалось загрузить консультации. Попробуйте обновить страницу.</p>';
    return;
  }

  const upcoming = bookings
    .filter((b) => ['pending', 'confirmed'].includes(b.status))
    .sort((a, b) => new Date(a.start) - new Date(b.start));
  const history = bookings.filter((b) => ['completed', 'cancelled'].includes(b.status));

  container.innerHTML = `
    <div class="page-head">
      <h1 class="page-title">Мои консультации</h1>
      <a class="btn btn--sm" href="#/catalog">Новая запись</a>
    </div>
    <div id="cabinet-root">
      <h2 class="section-title">Предстоящие</h2>
      <div>${upcoming.length
        ? upcoming.map((b) => bookingCard(b, true)).join('')
        : '<p class="form-hint">Предстоящих консультаций нет — <a href="#/catalog">выберите специалиста</a>.</p>'}</div>
      <h2 class="section-title">История</h2>
      <div>${history.length
        ? history.map((b) => bookingCard(b, false)).join('')
        : '<p class="form-hint">Здесь появятся проведённые и отменённые консультации.</p>'}</div>
    </div>`;

  container.querySelector('#cabinet-root').addEventListener('click', async (event) => {
    const btn = event.target.closest('[data-action]');
    if (!btn) return;
    const card = btn.closest('.booking-card');
    try {
      await api(`/bookings/${card.dataset.id}/${btn.dataset.action}`, { method: 'POST', body: {} });
      toast(btn.dataset.action === 'confirm' ? 'Запись подтверждена' : 'Запись отменена', 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
    renderCabinet(container);
  });
}
