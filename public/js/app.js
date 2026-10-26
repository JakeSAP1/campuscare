import { api, getToken, setToken } from './api.js';
import { esc, toast, TYPE_INFO } from './ui.js';
import { state } from './state.js';
import { renderLogin, renderRegister } from './views/auth.js';
import { renderCatalog } from './views/catalog.js';
import { renderSpecialist } from './views/specialist.js';

function renderHome(container) {
  const cards = Object.entries(TYPE_INFO)
    .map(([type, info]) => `
      <a class="type-card" href="#/catalog?type=${type}">
        <span class="type-card__emoji">${info.emoji}</span>
        <span class="type-card__label">${esc(info.label)}</span>
        <span class="type-card__tagline">${esc(info.tagline)}</span>
      </a>`)
    .join('');
  container.innerHTML = `
    <section class="hero card">
      <h1>Запись на консультации без живой очереди</h1>
      <p>Выберите тип консультации — дальше подберёте специалиста и удобное время.</p>
    </section>
    <section class="type-grid">${cards}</section>`;
}

function renderHeader() {
  const nav = document.getElementById('nav');
  const right = document.getElementById('header-user');

  if (!state.me) {
    nav.innerHTML = '<a href="#/" data-route="/">Главная</a>';
    right.innerHTML = `
      <a class="btn btn--ghost btn--sm" href="#/login">Войти</a>
      <a class="btn btn--sm" href="#/register">Регистрация</a>`;
    return;
  }

  nav.innerHTML = '<a href="#/" data-route="/">Главная</a><a href="#/catalog" data-route="/catalog">Каталог</a>';
  right.innerHTML = `
    <span class="user-chip">${esc(state.me.name)}</span>
    <button class="btn btn--ghost btn--sm" id="logout-btn">Выйти</button>`;

  right.querySelector('#logout-btn').addEventListener('click', async () => {
    try {
      await api('/logout', { method: 'POST' });
    } catch {
      // сессия уже неактивна — выходим в любом случае
    }
    setToken(null);
    state.me = null;
    location.hash = '#/';
    route();
    toast('Вы вышли из аккаунта');
  });
}

const routes = [
  { pattern: /^\/$/, view: renderHome },
  { pattern: /^\/catalog$/, view: renderCatalog },
  { pattern: /^\/specialist\/([\w-]+)$/, view: renderSpecialist },
  { pattern: /^\/login$/, view: renderLogin },
  { pattern: /^\/register$/, view: renderRegister },
];

async function route() {
  const [rawPath, rawQuery] = (location.hash.slice(1) || '/').split('?');
  const path = rawPath || '/';
  const params = new URLSearchParams(rawQuery);
  const app = document.getElementById('app');
  const current = routes.map((r) => ({ route: r, match: path.match(r.pattern) })).find((r) => r.match);

  if (!current) {
    app.innerHTML = '<section class="card"><h2>Страница не найдена</h2><p><a href="#/">На главную</a></p></section>';
    return;
  }

  if ((path === '/login' || path === '/register') && state.me) {
    location.hash = '#/';
    return;
  }

  renderHeader();
  await current.route.view(app, params, current.match[1]);
}

window.addEventListener('hashchange', route);

(async () => {
  if (getToken()) {
    try {
      const { user } = await api('/me');
      state.me = user;
    } catch {
      setToken(null);
    }
  }
  route();
})();
