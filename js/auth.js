/* SURO — Utilitaires auth partagés */

const SURO_VALIDATORS = {
  email(value) {
    if (!value) return 'L\'email est requis';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      return 'Adresse email invalide (ex: nom@domaine.com)';
    }
    return true;
  },

  phone(value) {
    if (!value) return 'Le numéro est requis';
    if (!/^[+]?[\d\s\-()]{10,}$/.test(value.replace(/\s/g, ''))) {
      return 'Numéro invalide (ex: +212 6 XX XX XX XX)';
    }
    return true;
  },

  name(value) {
    if (!value) return 'Le nom est requis';
    if (value.trim().length < 2) return 'Nom trop court';
    return true;
  },

  password(value) {
    if (!value) return 'Le mot de passe est requis';
    if (value.length < 8) return 'Minimum 8 caractères';
    return true;
  },
};

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
  const form = btn.closest('form');
  if (form) {
    form.querySelectorAll('input, select, textarea').forEach((el) => {
      if (loading) el.setAttribute('disabled', '');
      else el.removeAttribute('disabled');
    });
  }
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
    el.setAttribute('role', 'alert');
  }
}

function clearFieldError(errorId, inputId) {
  const el = document.getElementById(errorId);
  const input = inputId ? document.getElementById(inputId) : null;
  if (el) {
    el.classList.remove('show');
    el.textContent = '';
    el.removeAttribute('role');
  }
  if (input) {
    input.removeAttribute('aria-invalid');
    input.removeAttribute('aria-describedby');
  }
}

function clearErrors() {
  document.querySelectorAll('.error-message, .field-error').forEach((el) => {
    el.classList.remove('show');
    el.textContent = '';
    el.removeAttribute('role');
  });
  document.querySelectorAll('[aria-invalid="true"]').forEach((input) => {
    input.removeAttribute('aria-invalid');
    input.removeAttribute('aria-describedby');
  });
}

function showFieldError(errorId, message, inputId) {
  clearFieldError(errorId, inputId);
  const el = document.getElementById(errorId);
  const input = inputId ? document.getElementById(inputId) : null;
  if (el) {
    el.textContent = message;
    el.classList.add('show');
    el.setAttribute('role', 'alert');
  }
  if (input) {
    input.setAttribute('aria-invalid', 'true');
    input.setAttribute('aria-describedby', errorId);
    input.focus();
  }
}

function validateField(validator, value, errorId, inputId) {
  const result = validator(value);
  if (result !== true) {
    showFieldError(errorId, result, inputId);
    return false;
  }
  clearFieldError(errorId, inputId);
  return true;
}
