import { api } from '../api.js';
import { esc, fmtDateTime } from '../ui.js';

const TYPE_ICONS = {
  booking_new: '🗓️',
  booking_confirmed: '✅',
  booking_cancelled: '🚫',
  booking_rescheduled: '🔁',
  booking_completed: '✔️',
  review_new: '⭐',
  reminder: '⏰',
};

export async function renderNotifications(container) {
  container.innerHTML = '<p class="form-hint">Загружаю…</p>';

  let notifications;
  let unread;
  try {
    ({ notifications, unread } = await api('/notifications'));
  } catch {
    container.innerHTML = '<p class="form-error">Не удалось загрузить уведомления.</p>';
    return;
  }

  container.innerHTML = `
    <div class="page-head">
      <h1 class="page-title">Уведомления</h1>
      ${unread ? '<button class="btn btn--ghost btn--sm" id="read-all">Прочитать все</button>' : ''}
    </div>
    <div id="notifications-list">
      ${notifications.length ? notifications.map((n) => `
        <div class="card notif-card ${n.read ? '' : 'notif-card--unread'}" data-id="${n.id}">
          <span class="notif-card__icon">${TYPE_ICONS[n.type] || '🔔'}</span>
          <div class="notif-card__body">
            <p class="notif-card__text">${esc(n.text)}</p>
            <span class="notif-card__date">${fmtDateTime(n.createdAt)}</span>
          </div>
          ${n.read ? '' : '<button class="btn btn--ghost btn--sm" data-read>Прочитать</button>'}
        </div>`).join('')
      : '<p class="form-hint">Уведомлений пока нет — они появятся после записи и действий второй стороны.</p>'}
    </div>`;

  const rerender = () => renderNotifications(container);

  const readAll = container.querySelector('#read-all');
  if (readAll) {
    readAll.addEventListener('click', async () => {
      try {
        await api('/notifications/read', { method: 'POST', body: {} });
      } catch {}
      rerender();
    });
  }

  container.querySelector('#notifications-list').addEventListener('click', async (event) => {
    const btn = event.target.closest('[data-read]');
    if (!btn) return;
    const card = btn.closest('.notif-card');
    try {
      await api(`/notifications/${card.dataset.id}/read`, { method: 'POST', body: {} });
    } catch {}
    rerender();
  });
}
