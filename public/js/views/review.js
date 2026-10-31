import { api } from '../api.js';
import { esc, fmtDate, fmtTime, openModal, toast } from '../ui.js';

export function openReviewModal(booking, onDone) {
  const { overlay, close } = openModal(`
    <h2>Отзыв о консультации</h2>
    <p class="modal__meta">${esc(booking.specialist.name)} · ${fmtDate(booking.start)}, ${fmtTime(booking.start)}</p>
    <form id="review-form">
      <div class="field">
        <label>Оценка</label>
        <div class="star-picker" id="star-picker">
          ${[1, 2, 3, 4, 5].map((value) => `<button type="button" class="star-btn" data-value="${value}" aria-label="Оценка ${value}">★</button>`).join('')}
          <span class="star-picker__label" id="star-label">выберите звёзды</span>
          <input type="hidden" id="rating-input">
        </div>
      </div>
      <div class="field">
        <label>Впечатления</label>
        <textarea name="text" rows="3" placeholder="Что было полезно, что можно улучшить"></textarea>
      </div>
      <p class="form-error" hidden></p>
      <div class="modal__actions">
        <button type="button" class="btn btn--ghost" data-close>Позже</button>
        <button type="submit" class="btn">Отправить</button>
      </div>
    </form>
    <p class="form-hint">Отзыв публикуется анонимно — специалист не увидит автора.</p>`);

  const form = overlay.querySelector('#review-form');
  const ratingInput = overlay.querySelector('#rating-input');
  const label = overlay.querySelector('#star-label');
  const error = overlay.querySelector('.form-error');
  overlay.querySelector('[data-close]').addEventListener('click', close);

  overlay.querySelector('#star-picker').addEventListener('click', (event) => {
    const star = event.target.closest('.star-btn');
    if (!star) return;
    const value = Number(star.dataset.value);
    ratingInput.value = value;
    label.textContent = `${value} из 5`;
    overlay.querySelectorAll('.star-btn').forEach((item) => item.classList.toggle('star-btn--on', Number(item.dataset.value) <= value));
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    error.hidden = true;

    const rating = Number(ratingInput.value);
    if (!rating) {
      error.textContent = 'Поставьте оценку — от 1 до 5 звёзд';
      error.hidden = false;
      return;
    }

    try {
      await api('/reviews', { method: 'POST', body: { bookingId: booking.id, rating, text: form.elements.text.value.trim() } });
      close();
      toast('Спасибо! Отзыв опубликован анонимно', 'success');
      onDone();
    } catch (err) {
      error.textContent = err.message;
      error.hidden = false;
    }
  });
}
