import { requestJson } from './api.js';

const form = document.querySelector('[data-auth-form]');
const message = document.querySelector('#form-message');

if (
  message instanceof HTMLElement &&
  new URLSearchParams(window.location.search).has('registered')
) {
  showMessage('Registration complete. You can log in now.', 'success');
}

if (form instanceof HTMLFormElement) {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!form.reportValidity()) {
      return;
    }

    const mode = form.dataset.authForm;
    const email = form.email.value;
    const password = form.password.value;
    const button = form.querySelector('button[type="submit"]');

    setSubmitting(button, true);
    clearMessage();

    try {
      if (mode === 'register') {
        await requestJson('/api/auth/register', {
          method: 'POST',
          body: JSON.stringify({ email, password })
        });
        window.location.assign('/login?registered=1');
        return;
      }

      await requestJson('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      window.location.assign('/projects');
    } catch (error) {
      showMessage(error instanceof Error ? error.message : 'Request failed', 'error');
    } finally {
      setSubmitting(button, false);
    }
  });
}

function showMessage(text, kind) {
  if (!(message instanceof HTMLElement)) {
    return;
  }

  message.textContent = text;
  message.dataset.kind = kind;
  message.hidden = false;
}

function clearMessage() {
  if (!(message instanceof HTMLElement)) {
    return;
  }

  message.textContent = '';
  message.hidden = true;
  delete message.dataset.kind;
}

function setSubmitting(button, isSubmitting) {
  if (!(button instanceof HTMLButtonElement)) {
    return;
  }

  button.disabled = isSubmitting;
  button.textContent = isSubmitting
    ? 'Please wait...'
    : button.form?.dataset.authForm === 'register'
      ? 'Register'
      : 'Log in';
}
