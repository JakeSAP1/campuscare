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

export function toast(message, type = 'info') {
  const item = document.createElement('div');
  item.className = `toast toast--${type}`;
  item.textContent = message;
  document.getElementById('toast-root').append(item);
  setTimeout(() => item.remove(), 3500);
}
