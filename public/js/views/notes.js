import { api } from '../api.js';
import { esc, fmtDateTime, toast } from '../ui.js';

export async function renderNotesTab(container) {
  container.innerHTML = '<p class="form-hint">Загружаю…</p>';

  let notes;
  try {
    ({ notes } = await api('/my/notes'));
  } catch {
    container.innerHTML = '<p class="form-error">Не удалось загрузить заметки.</p>';
    return;
  }

  container.innerHTML = `
    <section class="card">
      <h2>Мои заметки</h2>
      <form id="note-add">
        <div class="field">
          <textarea name="text" rows="2" placeholder="Новая заметка — например, вопросы к консультации"></textarea>
        </div>
        <button class="btn btn--sm" type="submit">Добавить</button>
      </form>
    </section>
    <div id="notes-list">
      ${notes.length ? notes.map((note) => `
        <div class="card note-card" data-id="${note.id}">
          <p class="note-card__text">${esc(note.text)}</p>
          <div class="note-card__foot">
            <span class="note-card__date">${fmtDateTime(note.updatedAt)}</span>
            <span class="note-card__actions">
              <button class="btn btn--ghost btn--sm" data-note-action="edit">Изменить</button>
              <button class="btn btn--ghost btn--sm" data-note-action="delete">Удалить</button>
            </span>
          </div>
        </div>`).join('') : '<p class="form-hint">Заметок пока нет — они видны только вам.</p>'}
    </div>`;

  const rerender = () => renderNotesTab(container);

  container.querySelector('#note-add').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const text = form.elements.text.value.trim();
    if (!text) return;
    try {
      await api('/my/notes', { method: 'POST', body: { text } });
      toast('Заметка добавлена', 'success');
      rerender();
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  const startEdit = (card, note) => {
    card.innerHTML = `
      <div class="field"><textarea name="text" rows="3">${esc(note.text)}</textarea></div>
      <div class="note-card__foot">
        <span class="note-card__date">${fmtDateTime(note.updatedAt)}</span>
        <span class="note-card__actions">
          <button class="btn btn--sm" data-note-action="save">Сохранить</button>
          <button class="btn btn--ghost btn--sm" data-note-action="cancel">Отмена</button>
        </span>
      </div>`;
    card.querySelector('textarea').focus();
  };

  container.querySelector('#notes-list').addEventListener('click', async (event) => {
    const btn = event.target.closest('[data-note-action]');
    if (!btn) return;
    const card = btn.closest('.note-card');
    const note = notes.find((n) => n.id === card.dataset.id);
    const action = btn.dataset.noteAction;

    if (action === 'edit') {
      startEdit(card, note);
      return;
    }
    if (action === 'cancel') {
      rerender();
      return;
    }
    if (action === 'delete') {
      try {
        await api(`/my/notes/${note.id}`, { method: 'DELETE' });
        toast('Заметка удалена');
        rerender();
      } catch (err) {
        toast(err.message, 'error');
      }
      return;
    }
    if (action === 'save') {
      const text = card.querySelector('textarea').value.trim();
      if (!text) {
        toast('Заметка пустая', 'error');
        return;
      }
      try {
        await api(`/my/notes/${note.id}`, { method: 'PATCH', body: { text } });
        toast('Заметка сохранена', 'success');
        rerender();
      } catch (err) {
        toast(err.message, 'error');
      }
    }
  });
}
