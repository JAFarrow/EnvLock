export class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

export async function requestJson(path, options = {}) {
  const headers = new Headers(options.headers);

  if (options.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(path, {
    ...options,
    headers,
    credentials: 'same-origin'
  });
  const body = await readJson(response);

  if (!response.ok) {
    throw new ApiError(getErrorMessage(body, response.statusText), response.status, body);
  }

  return body;
}

export function configureLogoutButton() {
  const logoutButton = document.querySelector('#logout-button');

  if (!(logoutButton instanceof HTMLButtonElement)) {
    return;
  }

  logoutButton.addEventListener('click', async () => {
    logoutButton.disabled = true;
    logoutButton.textContent = 'Logging out...';

    try {
      await requestJson('/api/auth/logout', { method: 'POST' });
    } finally {
      window.location.assign('/login');
    }
  });
}

async function readJson(response) {
  const text = await response.text();

  if (text.length === 0) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function getErrorMessage(body, fallback) {
  if (typeof body?.message === 'string') {
    return body.message;
  }

  if (Array.isArray(body?.message) && typeof body.message[0] === 'string') {
    return body.message[0];
  }

  return fallback || 'Request failed';
}
