import { api, setToken } from '../api.js';
import { esc, toast } from '../ui.js';
import { state } from '../state.js';

const hourOptions = (from, to, selected) =>
  Array.from({ length: to - from + 1 }, (_, index) => {
    const hour = from + index;
    return `<option value="${hour}" ${hour === selected ? 'selected' : ''}>${hour}:00</option>`;
  }).join('');

export function renderLogin(container) {
  container.innerHTML = `
    <section class="auth card">
      <h1>Вход</h1>
      <form id="login-form">
        <div class="field">
          <label for="login-email">E-mail</label>
          <input id="login-email" name="email" type="email" required>
        </div>
        <div class="field">
          <label for="login-password">Пароль</label>
          <input id="login-password" name="password" type="password" required>
        </div>
        <p class="form-error" id="login-error" hidden></p>
        <button class="btn btn--wide" type="submit">Войти</button>
      </form>
      <div class="demo-box">
        <p>Демо-аккаунты, пароль <code>demo1234</code>:</p>
        <button type="button" class="btn btn--ghost btn--sm" data-fill="student@campuscare.ru">Студент</button>
        <button type="button" class="btn btn--ghost btn--sm" data-fill="psychologist@campuscare.ru">Специалист</button>
      </div>
      <p class="auth__switch">Нет аккаунта? <a href="#/register">Зарегистрируйтесь</a></p>
    </section>`;

  const form = container.querySelector('#login-form');
  const error = container.querySelector('#login-error');

  container.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-fill]');
    if (!btn) return;
    form.email.value = btn.dataset.fill;
    form.password.value = 'demo1234';
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    error.hidden = true;
    try {
      const { token, user } = await api('/login', {
        method: 'POST',
        body: { email: form.elements.email.value.trim(), password: form.elements.password.value },
      });
      setToken(token);
      state.me = user;
      toast(`Здравствуйте, ${user.name}`, 'success');
      location.hash = '#/';
    } catch (err) {
      error.textContent = err.message;
      error.hidden = false;
    }
  });
}

export function renderRegister(container) {
  container.innerHTML = `
    <section class="auth card">
      <h1>Регистрация</h1>
      <form id="register-form">
        <div class="role-switch" id="role-switch">
          <label><input type="radio" name="role" value="student" checked> Студент</label>
          <label><input type="radio" name="role" value="specialist"> Специалист</label>
        </div>
        <div class="field">
          <label for="reg-name">Имя</label>
          <input id="reg-name" name="name" required>
        </div>
        <div class="field">
          <label for="reg-email">E-mail</label>
          <input id="reg-email" name="email" type="email" required>
        </div>
        <div class="field">
          <label for="reg-password">Пароль</label>
          <input id="reg-password" name="password" type="password" minlength="6" required>
          <p class="form-hint">Не короче 6 символов.</p>
        </div>
        <div id="specialist-fields" hidden>
          <div class="field">
            <label for="reg-type">Тип консультаций</label>
            <select id="reg-type" name="type">
              <option value="psychologist">Психолог</option>
              <option value="career">Карьерный консультант</option>
              <option value="tutor">Тьютор</option>
            </select>
          </div>
          <div class="field">
            <label for="reg-spec">Специализация</label>
            <input id="reg-spec" name="specialization" placeholder="Например: тревога и стресс перед экзаменами">
          </div>
          <div class="field">
            <label for="reg-bio">О себе</label>
            <textarea id="reg-bio" name="bio" rows="3"></textarea>
          </div>
          <div class="field">
            <label>Формат приёма</label>
            <label class="check"><input type="checkbox" name="format-online" checked> Онлайн</label>
            <label class="check"><input type="checkbox" name="format-offline"> Очно</label>
          </div>
          <div class="field-row">
            <div class="field">
              <label for="reg-from">Начало приёма</label>
              <select id="reg-from" name="workFrom">${hourOptions(8, 14, 10)}</select>
            </div>
            <div class="field">
              <label for="reg-to">Конец приёма</label>
              <select id="reg-to" name="workTo">${hourOptions(12, 21, 18)}</select>
            </div>
          </div>
        </div>
        <p class="form-error" id="register-error" hidden></p>
        <button class="btn btn--wide" type="submit">Создать аккаунт</button>
      </form>
      <p class="auth__switch">Уже есть аккаунт? <a href="#/login">Войдите</a></p>
    </section>`;

  const form = container.querySelector('#register-form');
  const error = container.querySelector('#register-error');
  const specialistFields = container.querySelector('#specialist-fields');

  container.querySelector('#role-switch').addEventListener('change', (event) => {
    specialistFields.hidden = event.target.value !== 'specialist';
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    error.hidden = true;

    const fields = form.elements;
    const body = {
      role: fields.role.value,
      name: fields.name.value.trim(),
      email: fields.email.value.trim(),
      password: fields.password.value,
    };

    if (body.role === 'specialist') {
      const formats = ['online', 'offline'].filter((format) => fields[`format-${format}`].checked);
      if (!formats.length) {
        error.textContent = 'Выберите хотя бы один формат приёма';
        error.hidden = false;
        return;
      }
      body.specialist = {
        type: fields.type.value,
        specialization: fields.specialization.value.trim(),
        bio: fields.bio.value.trim(),
        formats,
        workFrom: Number(fields.workFrom.value),
        workTo: Number(fields.workTo.value),
      };
    }

    try {
      const { token, user } = await api('/register', { method: 'POST', body });
      setToken(token);
      state.me = user;
      toast(`Аккаунт создан. Здравствуйте, ${esc(user.name)}`, 'success');
      location.hash = '#/';
    } catch (err) {
      error.textContent = err.message;
      error.hidden = false;
    }
  });
}
