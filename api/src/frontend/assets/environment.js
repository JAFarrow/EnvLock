import {
  apiRequest,
  clearMessage,
  configureProjectNavigation,
  createButton,
  createElement,
  createEmptyState,
  formatDate,
  getFormValue,
  handleError,
  renderProjectChrome,
  setStatus,
  setSubmitting,
  setText,
  setVisible,
  showMessage
} from './project-page.js';

const pageTitle = document.querySelector('#page-title');
const environmentOverviewLink = document.querySelector('#environment-overview-link');
const environmentTitle = document.querySelector('#environment-title');
const environmentDescription = document.querySelector('#environment-description');
const secretList = document.querySelector('#secret-list');
const createSecretForm = document.querySelector('#create-secret-form');

const route = getEnvironmentRouteFromPath();
const state = {
  project: null,
  environment: null,
  secrets: []
};

if (route !== null) {
  configureProjectNavigation(route.projectId);
  configureEnvironmentNavigation(route.projectId);
  bindEvents();
  await loadPage();
}

function bindEvents() {
  if (createSecretForm instanceof HTMLFormElement) {
    createSecretForm.addEventListener('submit', handleCreateSecret);
  }
}

async function loadPage() {
  clearMessage();
  setStatus('Loading environment...');

  try {
    const [project, environment, secretBody] = await Promise.all([
      apiRequest(`/api/projects/${route.projectId}`),
      apiRequest(`/api/projects/${route.projectId}/environments/${route.environmentId}`),
      apiRequest(`/api/projects/${route.projectId}/environments/${route.environmentId}/secrets`)
    ]);

    state.project = project;
    state.environment = environment;
    state.secrets = Array.isArray(secretBody?.items) ? secretBody.items : [];

    renderProjectChrome(project, `Environment · ${environment.name}`);
    renderEnvironmentDetails();
    renderSecrets();
  } catch (error) {
    handleError(error, 'Unable to load environment.');
  }
}

async function handleCreateSecret(event) {
  event.preventDefault();

  if (!(createSecretForm instanceof HTMLFormElement) || !createSecretForm.reportValidity()) {
    return;
  }

  const payload = {
    key: getFormValue(createSecretForm, 'key').trim(),
    value: getFormValue(createSecretForm, 'value')
  };
  const button = createSecretForm.querySelector('button[type="submit"]');
  setSubmitting(button, true, 'Create secret', 'Creating...');
  clearMessage();

  try {
    const secret = await apiRequest(secretCollectionPath(), {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    createSecretForm.reset();
    await loadPage();
    showMessage(`Created ${secret.key}.`, 'success');
  } catch (error) {
    handleError(error, 'Unable to create secret.');
  } finally {
    setSubmitting(button, false, 'Create secret', 'Creating...');
  }
}

async function handleSetSecretValue(secret, form) {
  if (!form.reportValidity()) {
    return;
  }

  const button = form.querySelector('button[type="submit"]');
  setSubmitting(button, true, 'Set value', 'Saving...');
  clearMessage();

  try {
    await apiRequest(`${secretCollectionPath()}/${secret.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ value: getFormValue(form, 'value') })
    });
    form.reset();
    await loadPage();
    showMessage(`Updated ${secret.key}.`, 'success');
  } catch (error) {
    handleError(error, 'Unable to set secret value.');
  } finally {
    setSubmitting(button, false, 'Set value', 'Saving...');
  }
}

async function handleDeleteSecret(secret) {
  if (!window.confirm(`Delete ${secret.key}? This archives the secret.`)) {
    return;
  }

  clearMessage();

  try {
    await apiRequest(`${secretCollectionPath()}/${secret.id}`, { method: 'DELETE' });
    await loadPage();
    showMessage(`Deleted ${secret.key}.`, 'success');
  } catch (error) {
    handleError(error, 'Unable to delete secret.');
  }
}

function renderEnvironmentDetails() {
  if (state.environment === null) {
    return;
  }

  setText(pageTitle, state.environment.name);
  setText(environmentTitle, state.environment.name);
  setText(environmentDescription, state.environment.description || 'No description provided.');
}

function renderSecrets() {
  if (!(secretList instanceof HTMLElement) || state.project === null) {
    return;
  }

  const canManage = ['owner', 'maintainer'].includes(state.project.role);
  setVisible(createSecretForm, canManage);
  secretList.replaceChildren();

  if (state.secrets.length === 0) {
    secretList.append(createEmptyState('No secret keys yet.', getSecretEmptyText(canManage)));
    return;
  }

  for (const secret of state.secrets) {
    secretList.append(createSecretItem(secret, canManage));
  }
}

function createSecretItem(secret, canManage) {
  const content = document.createElement('div');
  content.append(
    createElement('h3', '', secret.key),
    createElement('p', 'resource-meta', `Updated ${formatDate(secret.updatedAt)}`)
  );

  if (!canManage) {
    const item = document.createElement('article');
    item.className = 'resource-item';
    item.append(content);
    return item;
  }

  const item = document.createElement('details');
  item.className = 'resource-item secret-item';

  const summary = document.createElement('summary');
  summary.className = 'secret-summary';
  summary.append(content);

  const controls = document.createElement('div');
  controls.className = 'secret-actions';
  controls.append(createSecretValueForm(secret));

  item.append(summary, controls);

  return item;
}

function createSecretValueForm(secret) {
  const form = document.createElement('form');
  form.className = 'secret-value-form';
  form.noValidate = true;
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    void handleSetSecretValue(secret, form);
  });

  const valueId = `secret-value-${secret.id}`;
  const label = document.createElement('label');
  label.setAttribute('for', valueId);
  label.textContent = 'Replacement value';

  const textarea = document.createElement('textarea');
  textarea.id = valueId;
  textarea.name = 'value';
  textarea.rows = 2;
  textarea.autocomplete = 'off';
  textarea.placeholder = `Paste new value for ${secret.key}`;

  const button = document.createElement('button');
  button.className = 'button-small';
  button.type = 'submit';
  button.textContent = 'Set value';

  const buttonRow = document.createElement('div');
  buttonRow.className = 'secret-button-row';
  buttonRow.append(button, createDeleteSecretButton(secret));

  form.append(label, textarea, buttonRow);
  return form;
}

function createDeleteSecretButton(secret) {
  const button = createButton('Delete', 'button-danger button-small');
  button.classList.add('secret-delete-button');
  button.addEventListener('click', () => void handleDeleteSecret(secret));
  return button;
}

function configureEnvironmentNavigation(projectId) {
  if (environmentOverviewLink instanceof HTMLAnchorElement) {
    environmentOverviewLink.href = `/projects/${projectId}/environments`;
  }
}

function getEnvironmentRouteFromPath() {
  const [, resource, projectId, subpage, environmentId] = window.location.pathname.split('/');

  if (resource !== 'projects' || typeof projectId !== 'string' || projectId.length === 0) {
    window.location.assign('/projects');
    return null;
  }

  if (
    subpage !== 'environments' ||
    typeof environmentId !== 'string' ||
    environmentId.length === 0
  ) {
    window.location.assign(`/projects/${projectId}/environments`);
    return null;
  }

  return { projectId, environmentId };
}

function secretCollectionPath() {
  return `/api/projects/${route.projectId}/environments/${route.environmentId}/secrets`;
}

function getSecretEmptyText(canManage) {
  return canManage
    ? 'Create a secret from the form on this page.'
    : 'Owners and maintainers can create secrets.';
}
