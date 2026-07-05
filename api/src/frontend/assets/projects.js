import { requestJson } from './api.js';

const projectList = document.querySelector('#project-list');
const status = document.querySelector('#projects-status');
const message = document.querySelector('#projects-message');
const createProjectForm = document.querySelector('#create-project-form');

const state = {
  projects: []
};

if (createProjectForm instanceof HTMLFormElement) {
  createProjectForm.addEventListener('submit', handleCreateProject);
}

await loadProjects();

async function loadProjects() {
  clearMessage();
  setStatus('Loading projects...');

  try {
    const body = await apiRequest('/api/projects');
    state.projects = Array.isArray(body?.projects) ? body.projects : [];
    renderProjects();
    setStatus(getProjectStatusText());
  } catch (error) {
    handleError(error, 'Unable to load projects.');
  }
}

async function handleCreateProject(event) {
  event.preventDefault();

  if (!(createProjectForm instanceof HTMLFormElement) || !createProjectForm.reportValidity()) {
    return;
  }

  const payload = compactPayload({
    name: getFormValue(createProjectForm, 'name'),
    description: getFormValue(createProjectForm, 'description'),
    repositoryUrl: getFormValue(createProjectForm, 'repositoryUrl')
  });
  const button = createProjectForm.querySelector('button[type="submit"]');
  setSubmitting(button, true, 'Create project', 'Creating...');
  clearMessage();

  try {
    const project = await apiRequest('/api/projects', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    createProjectForm.reset();
    await loadProjects();
    showMessage(`Created ${project.name}.`, 'success');
  } catch (error) {
    handleError(error, 'Unable to create project.');
  } finally {
    setSubmitting(button, false, 'Create project', 'Creating...');
  }
}

async function handleDeleteProject(project) {
  if (!window.confirm(`Delete ${project.name}? This archives the project.`)) {
    return;
  }

  clearMessage();

  try {
    await apiRequest(`/api/projects/${project.id}`, { method: 'DELETE' });
    await loadProjects();
    showMessage(`Deleted ${project.name}.`, 'success');
  } catch (error) {
    handleError(error, 'Unable to delete project.');
  }
}

function renderProjects() {
  if (!(projectList instanceof HTMLElement)) {
    return;
  }

  projectList.replaceChildren();

  if (state.projects.length === 0) {
    projectList.append(createEmptyState('No projects yet.', 'Create your first project to begin.'));
    return;
  }

  for (const project of state.projects) {
    projectList.append(createProjectCard(project));
  }
}

function createProjectCard(project) {
  const card = document.createElement('article');
  card.className = 'project-summary-card';

  const header = document.createElement('div');
  header.className = 'project-summary-header';
  header.append(createElement('span', 'badge', formatRole(project.role)));

  if (project.role === 'owner') {
    const deleteButton = createButton('Delete', 'button-danger button-small');
    deleteButton.addEventListener('click', () => void handleDeleteProject(project));
    header.append(deleteButton);
  }

  const body = document.createElement('div');
  body.append(
    createElement('h2', '', project.name),
    createElement('p', '', project.description || 'No description provided.')
  );

  if (typeof project.repositoryUrl === 'string' && project.repositoryUrl.length > 0) {
    const repositoryLink = document.createElement('a');
    repositoryLink.href = project.repositoryUrl;
    repositoryLink.target = '_blank';
    repositoryLink.rel = 'noreferrer';
    repositoryLink.textContent = project.repositoryUrl;
    body.append(repositoryLink);
  }

  const navigation = document.createElement('nav');
  navigation.className = 'project-nav-links';
  navigation.setAttribute('aria-label', `${project.name} management pages`);
  navigation.append(
    createNavLink('Environments', `/projects/${project.id}/environments`),
    createNavLink('Roles', `/projects/${project.id}/roles`),
    createNavLink('PATs', `/projects/${project.id}/pats`)
  );

  card.append(header, body, navigation);
  return card;
}

async function apiRequest(path, options) {
  try {
    return await requestJson(path, options);
  } catch (error) {
    if (error?.status === 401) {
      window.location.assign('/login');
    }

    throw error;
  }
}

function compactPayload(payload) {
  const compacted = {};

  for (const [key, value] of Object.entries(payload)) {
    const trimmedValue = typeof value === 'string' ? value.trim() : value;

    if (trimmedValue !== '') {
      compacted[key] = trimmedValue;
    }
  }

  return compacted;
}

function getFormValue(form, name) {
  const value = new FormData(form).get(name);

  return typeof value === 'string' ? value : '';
}

function getProjectStatusText() {
  const count = state.projects.length;

  return `Signed in. ${count} project${count === 1 ? '' : 's'} found.`;
}

function createNavLink(text, href) {
  const link = document.createElement('a');
  link.className = 'button-link';
  link.href = href;
  link.textContent = text;
  return link;
}

function createEmptyState(title, text) {
  const emptyState = document.createElement('div');
  emptyState.className = 'empty-state';
  emptyState.append(createElement('strong', '', title), createElement('p', '', text));
  return emptyState;
}

function createElement(tagName, className, text) {
  const element = document.createElement(tagName);

  if (className.length > 0) {
    element.className = className;
  }

  element.textContent = text;
  return element;
}

function createButton(text, className) {
  const button = document.createElement('button');
  button.className = className;
  button.type = 'button';
  button.textContent = text;
  return button;
}

function formatRole(role) {
  return `${role.charAt(0).toUpperCase()}${role.slice(1)}`;
}

function handleError(error, fallback) {
  const text = error instanceof Error ? error.message : fallback;
  setStatus(fallback);
  showMessage(text, 'error');
}

function setStatus(text) {
  if (status instanceof HTMLElement) {
    status.textContent = text;
  }
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

function setSubmitting(button, isSubmitting, readyText, loadingText) {
  if (!(button instanceof HTMLButtonElement)) {
    return;
  }

  button.disabled = isSubmitting;
  button.textContent = isSubmitting ? loadingText : readyText;
}
