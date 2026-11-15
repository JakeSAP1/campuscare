import { api } from '../api.js';
import { esc, toast } from '../ui.js';
import { state } from '../state.js';

export function renderProfileTab(container) {
  const me = state.me;
  container.innerHTML = `
    <section class="card profile-card">
      <h2>Профиль</h2>
      <form id="profile-form">
        <div class="field">
          <label>Имя</label>
          <input name="name" value="${esc(me.name)}" required maxlength="80">
        </div>
        <div class="field">
          <label>E-mail</label>
          <input value="${esc(me.email)}" disabled>
          <p class="form-hint">Почта — это логин, поменять её нельзя.</p>
        </div>
        ${me.role === 'specialist' ? `
          <div class="field"><label>Тип консультаций</label><input value="${esc(me.typeLabel)}" disabled></div>
          <div class="field"><label>Специализация</label><input value="${esc(me.specialization)}" disabled></div>
          <div class="field"><label>Часы приёма</label><input value="с ${me.workFrom}:00 до ${me.workTo}:00" disabled></div>` : ''}
        <p class="form-error" id="profile-error" hidden></p>
        <button class="btn" type="submit">Сохранить имя</button>
      </form>
    </section>
    <section class="card profile-card">
      <h2>Смена пароля</h2>
      <form id="password-form">
        <div class="field"><label>Старый пароль</label><input type="password" name="old" required></div>
        <div class="field"><label>Новый пароль (от 6 символов)</label><input type="password" name="next" minlength="6" required></div>
        <div class="field"><label>Повторите новый</label><input type="password" name="repeat" required></div>
        <p class="form-error" id="password-error" hidden></p>
        <button class="btn" type="submit">Сменить пароль</button>
      </form>
    </section>`;

  const profileForm = container.querySelector('#profile-form');
  profileForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const error = container.querySelector('#profile-error');
    error.hidden = true;
    try {
      const { user } = await api('/me', { method: 'PATCH', body: { name: profileForm.elements.name.value.trim() } });
      state.me = user;
      toast('Имя сохранено', 'success');
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    } catch (err) {
      error.textContent = err.message;
      error.hidden = false;
    }
  });

  const passwordForm = container.querySelector('#password-form');
  passwordForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const error = container.querySelector('#password-error');
    error.hidden = true;
    const fields = passwordForm.elements;
    if (fields.next.value !== fields.repeat.value) {
      error.textContent = 'Новые пароли не совпадают';
      error.hidden = false;
      return;
    }
    try {
      await api('/me/password', { method: 'POST', body: { oldPassword: fields.old.value, newPassword: fields.next.value } });
      passwordForm.reset();
      toast('Пароль изменён', 'success');
    } catch (err) {
      error.textContent = err.message;
      error.hidden = false;
    }
  });
}
