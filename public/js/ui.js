export const TYPE_INFO = {
  psychologist: { label: 'Психолог', emoji: '🧠', tagline: 'Тревога, стресс, отношения, адаптация к вузу' },
  career: { label: 'Карьерный консультант', emoji: '🎯', tagline: 'Профориентация, резюме, собеседования, стажировки' },
  tutor: { label: 'Тьютор', emoji: '🧭', tagline: 'Организация учёбы, планирование, долги по дисциплинам' },
};

export const esc = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[ch]));

export const stars = (rating) => {
  const rounded = Math.round(rating);
  return '★'.repeat(rounded) + '☆'.repeat(5 - rounded);
};

export const plural = (count, [one, few, many]) => {
  const mod100 = count % 100;
  if (mod100 >= 11 && mod100 <= 14) return many;
  const mod10 = count % 10;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
};

export const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', weekday: 'long' });

export const fmtTime = (iso) =>
  new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

export const fmtDateTime = (iso) =>
  new Date(iso).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export function toast(message, type = 'info') {
  const item = document.createElement('div');
  item.className = `toast toast--${type}`;
  item.textContent = message;
  document.getElementById('toast-root').append(item);
  setTimeout(() => item.remove(), 3500);
}
