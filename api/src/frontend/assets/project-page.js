import { requestJson } from './api.js';

const status = document.querySelector('#page-status');
const message = document.querySelector('#page-message');
const projectRole = document.querySelector('#project-role');

export function getProjectIdFromPath() {
  const [, resource, projectId] = window.location.pathname.split('/');

  if (resource !== 'projects' || typeof projectId !== 'string' || projectId.length === 0) {
    window.location.assign('/projects');
    return null;
  }

  return projectId;
}

export function configureProjectNavigation(projectId) {
  setLink('#environments-link', `/projects/${projectId}/environments`);
  setLink('#roles-link', `/projects/${projectId}/roles`);
  setLink('#pats-link', `/projects/${projectId}/pats`);
}

export async function apiRequest(path, options) {
  try {
    return await requestJson(path, options);
  } catch (error) {
    if (error?.status === 401) {
      window.location.assign('/login');
    }

    throw error;
  }
}

export function renderProjectChrome(project, sectionName) {
  setStatus(`${project.name} · ${sectionName}`);
  setText(projectRole, formatRole(project.role));
}

export function showMessage(text, kind) {
  if (!(message instanceof HTMLElement)) {
    return;
  }

  message.textContent = text;
  message.dataset.kind = kind;
  message.hidden = false;
}

export function clearMessage() {
  if (!(message instanceof HTMLElement)) {
    return;
  }

  message.textContent = '';
  message.hidden = true;
  delete message.dataset.kind;
}

export function handleError(error, fallback) {
  const text = error instanceof Error ? error.message : fallback;
  setStatus(fallback);
  showMessage(text, 'error');
}

export function setStatus(text) {
  setText(status, text);
}

export function setText(element, text) {
  if (element instanceof HTMLElement) {
    element.textContent = text;
  }
}

export function setVisible(element, isVisible) {
  if (element instanceof HTMLElement) {
    element.hidden = !isVisible;
  }
}

export function getFormValue(form, name) {
  const value = new FormData(form).get(name);

  return typeof value === 'string' ? value : '';
}

export function compactPayload(payload) {
  const compacted = {};

  for (const [key, value] of Object.entries(payload)) {
    const trimmedValue = typeof value === 'string' ? value.trim() : value;

    if (trimmedValue !== '') {
      compacted[key] = trimmedValue;
    }
  }

  return compacted;
}

export function createEmptyState(title, text) {
  const emptyState = document.createElement('div');
  emptyState.className = 'empty-state';
  emptyState.append(createElement('strong', '', title), createElement('p', '', text));
  return emptyState;
}

export function createElement(tagName, className, text) {
  const element = document.createElement(tagName);

  if (className.length > 0) {
    element.className = className;
  }

  element.textContent = text;
  return element;
}

export function createButton(text, className) {
  const button = document.createElement('button');
  button.className = className;
  button.type = 'button';
  button.textContent = text;
  return button;
}

export function createRoleOption(role, selectedRole) {
  const option = document.createElement('option');
  option.value = role;
  option.textContent = formatRole(role);
  option.selected = role === selectedRole;
  return option;
}

export function formatRole(role) {
  return `${role.charAt(0).toUpperCase()}${role.slice(1)}`;
}

export function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value));
}

export function formatDateTimeLocal(value) {
  const offsetMilliseconds = value.getTimezoneOffset() * 60 * 1000;

  return new Date(value.getTime() - offsetMilliseconds).toISOString().slice(0, 16);
}

export function setSubmitting(button, isSubmitting, readyText, loadingText) {
  if (!(button instanceof HTMLButtonElement)) {
    return;
  }

  button.disabled = isSubmitting;
  button.textContent = isSubmitting ? loadingText : readyText;
}

function setLink(selector, href) {
  const link = document.querySelector(selector);

  if (link instanceof HTMLAnchorElement) {
    link.href = href;
  }
}
