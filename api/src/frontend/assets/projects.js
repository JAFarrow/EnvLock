import { requestJson } from './api.js';

const status = document.querySelector('#projects-status');

try {
  const body = await requestJson('/api/projects');
  const count = Array.isArray(body?.projects) ? body.projects.length : 0;

  setStatus(`Signed in. ${count} project${count === 1 ? '' : 's'} found.`);
} catch (error) {
  if (error?.status === 401) {
    window.location.assign('/login');
  } else {
    setStatus(error instanceof Error ? error.message : 'Unable to load projects.');
  }
}

function setStatus(text) {
  if (status instanceof HTMLElement) {
    status.textContent = text;
  }
}
