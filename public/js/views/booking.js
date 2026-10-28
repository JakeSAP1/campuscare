import { api } from '../api.js';
import { esc, fmtDate, fmtTime, openModal, toast } from '../ui.js';

const FORMAT_LABELS = { online: 'Онлайн', offline: 'Очно' };

export async function openBookingModal(slot, specialist) {
  let isFirst = true;
  try {
    const { bookings } = await api('/my/bookings');
    isFirst = !bookings.some((b) =>
      b.specialist.id === specialist.id && ['pending', 'confirmed', 'completed'].includes(b.status));
  } catch {
    isFirst = true;
  }

  const formatChoices = specialist.formats
    .map((format) => `<label class="check"><input type="radio" name="format" value="${format}" ${format === specialist.formats[0] ? 'checked' : ''}> ${FORMAT_LABELS[format]}</label>`)
    .join('');

  const questionnaireHtml = isFirst ? `
    <div class="modal__section">
      <h3>Анкета перед первой консультацией</h3>
      <div class="field">
        <label>Курс и направление</label>
        <input name="course" placeholder="Например: 3 курс, ИВТ" required>
      </div>
      <div class="field">
        <label>С каким запросом идёте</label>
        <textarea name="request" rows="3" placeholder="Коротко, своими словами" required></textarea>
      </div>
      <div class="field">
        <label>Опыт консультаций</label>
        <select name="experience">
          <option value="первый опыт">Это первый опыт</option>
          <option value="был опыт">Обращался(ась) ранее</option>
        </select>
      </div>
      <div class="field">
        <label>Дополнительно</label>
        <textarea name="notes" rows="2" placeholder="Пожелания, удобное время — не обязательно"></textarea>
      </div>
    </div>` : '';

  const { overlay, close } = openModal(`
    <h2>Запись на консультацию</h2>
    <p class="modal__meta">${esc(specialist.name)} · ${fmtDate(slot.start)}, ${fmtTime(slot.start)}</p>
    <form id="booking-form">
      <div class="field"><label>Формат</label>${formatChoices}</div>
      ${questionnaireHtml}
      <p class="form-error" hidden></p>
      <div class="modal__actions">
        <button type="button" class="btn btn--ghost" data-close>Отмена</button>
        <button type="submit" class="btn">Отправить заявку</button>
      </div>
    </form>
    <p class="form-hint">Заявка уйдёт специалисту — он подтвердит время в своём кабинете.</p>`);

  const form = overlay.querySelector('#booking-form');
  const error = overlay.querySelector('.form-error');
  overlay.querySelector('[data-close]').addEventListener('click', close);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    error.hidden = true;

    const body = { slotId: slot.id, format: form.elements.format.value };
    if (isFirst) {
      body.questionnaire = {
        course: form.elements.course.value.trim(),
        request: form.elements.request.value.trim(),
        experience: form.elements.experience.value,
        notes: form.elements.notes.value.trim(),
      };
    }

    try {
      await api('/bookings', { method: 'POST', body });
      close();
      toast('Заявка отправлена — специалист подтвердит время', 'success');
      location.hash = '#/cabinet';
    } catch (err) {
      error.textContent = err.message;
      error.hidden = false;
    }
  });
}
