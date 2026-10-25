import { api, getToken, setToken } from './api.js';
import { esc, toast } from './ui.js';
import { state } from './state.js';

function renderHome(container) {
  container.innerHTML = `
    <section class="hero card">
      <h1>Запись на консультации без живой очереди</h1>
      <p>Психологи, карьерные консультанты и тьюторы университета — выберите специалиста и удобное время онлайн.</p>
      ${state.me
        ? '<p class="form-hint">Каталог специалистов в разработке — он появится в ближайших обновлениях.</p>'
        : `<p><a class="btn" href="#/register">Создать аккаунт</a> <a class="btn btn--ghost" href="#/login">Войти</a></p>`}
    </section>`;
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

  nav.innerHTML = '<a href="#/" data-route="/">Главная</a>';
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
];

async function route() {
  const path = (location.hash.slice(1) || '/').split('?')[0];
  const app = document.getElementById('app');
  const current = routes.find((r) => r.pattern.test(path));

  if (!current) {
    app.innerHTML = '<section class="card"><h2>Страница не найдена</h2><p><a href="#/">На главную</a></p></section>';
    return;
  }

  if ((path === '/login' || path === '/register') && state.me) {
    location.hash = '#/';
    return;
  }

  renderHeader();
  await current.view(app);
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
