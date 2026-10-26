import { api } from '../api.js';
import { esc, stars, plural, TYPE_INFO } from '../ui.js';

const FORMAT_LABELS = { online: 'Онлайн', offline: 'Очно' };

const catalogUrl = (type, format) => {
  const query = new URLSearchParams();
  if (type) query.set('type', type);
  if (format) query.set('format', format);
  return `#/catalog${query.toString() ? `?${query}` : ''}`;
};

const chips = (entries, active, makeUrl) =>
  entries
    .map(([value, label]) => `<a class="chip ${value === active ? 'chip--active' : ''}" href="${makeUrl(value)}">${esc(label)}</a>`)
    .join('');

export async function renderCatalog(container, params) {
  const type = params.get('type') || '';
  const format = params.get('format') || '';
  const query = new URLSearchParams({ ...(type && { type }), ...(format && { format }) }).toString();

  container.innerHTML = `
    <h1 class="page-title">Каталог специалистов</h1>
    <div class="chips">${chips([['', 'Все типы'], ...Object.entries(TYPE_INFO).map(([value, info]) => [value, info.label])], type, (value) => catalogUrl(value, format))}</div>
    <div class="chips">${chips([['', 'Любой формат'], ['online', 'Онлайн'], ['offline', 'Очно']], format, (value) => catalogUrl(type, value))}</div>
    <div class="spec-grid" id="spec-grid"><p class="form-hint">Загружаю…</p></div>`;

  const grid = container.querySelector('#spec-grid');

  let specialists;
  try {
    ({ specialists } = await api(`/specialists${query ? `?${query}` : ''}`));
  } catch {
    grid.innerHTML = '<p class="form-error">Не удалось загрузить каталог. Попробуйте обновить страницу.</p>';
    return;
  }

  grid.innerHTML = specialists.length
    ? specialists.map((s) => `
      <a class="spec-card" href="#/specialist/${s.id}">
        <div class="spec-card__head">
          <span class="spec-card__avatar">${esc(s.name[0])}</span>
          <span>
            <span class="spec-card__name">${esc(s.name)}</span>
            <span class="spec-card__type">${esc(s.typeLabel)}</span>
          </span>
        </div>
        <div class="spec-card__spec">${esc(s.specialization)}</div>
        <div class="spec-card__meta">
          <span class="rating">${stars(s.rating)} <b>${s.reviewsCount ? s.rating.toFixed(1) : '—'}</b></span>
          <span class="spec-card__count">${s.reviewsCount ? `${s.reviewsCount} ${plural(s.reviewsCount, ['отзыв', 'отзыва', 'отзывов'])}` : 'нет отзывов'}</span>
        </div>
        <div class="spec-card__formats">${s.formats.map((f) => `<span class="badge">${FORMAT_LABELS[f]}</span>`).join('')}</div>
      </a>`).join('')
    : '<p class="form-hint">Под такие фильтры никто не подошёл — сбросьте часть условий.</p>';
}
