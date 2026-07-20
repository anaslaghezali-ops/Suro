/* SURO — Utilitaires auth partagés */

function togglePassword(btn) {
  const wrap = btn.closest('.password-wrap');
  if (!wrap) return;
  const input = wrap.querySelector('input');
  const isHidden = input.type === 'password';
  input.type = isHidden ? 'text' : 'password';
  btn.setAttribute('aria-label', isHidden ? 'Masquer le mot de passe' : 'Afficher le mot de passe');
  btn.innerHTML = isHidden
    ? '<svg viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'
    : '<svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
}

function setLoading(btn, loading, loadingText, defaultText) {
  const spinner = btn.querySelector('.loading-spinner');
  const text = btn.querySelector('[data-btn-text]') || btn.querySelector('span:last-child');
  btn.disabled = loading;
  if (spinner) spinner.style.display = loading ? 'inline-block' : 'none';
  if (text) text.textContent = loading ? loadingText : defaultText;
}

function showFormError(id, message) {
  document.querySelectorAll('.error-message').forEach((el) => {
    if (el.id !== id) {
      el.classList.remove('show');
      el.textContent = '';
    }
  });
  const el = document.getElementById(id);
  if (el) {
    el.textContent = message;
    el.classList.add('show');
  }
}

function clearErrors() {
  document.querySelectorAll('.error-message, .field-error').forEach((el) => {
    el.classList.remove('show');
    el.textContent = '';
  });
}

function showFieldError(id, message) {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = message;
    el.classList.add('show');
  }
}
