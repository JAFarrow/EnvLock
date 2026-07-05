import {
  apiRequest,
  clearMessage,
  configureProjectNavigation,
  createButton,
  createElement,
  createEmptyState,
  formatDate,
  formatDateTimeLocal,
  getFormValue,
  getProjectIdFromPath,
  handleError,
  renderProjectChrome,
  setStatus,
  setSubmitting,
  setText,
  setVisible,
  showMessage
} from './project-page.js';

const patList = document.querySelector('#pat-list');
const createPatForm = document.querySelector('#create-pat-form');
const patTokenReveal = document.querySelector('#pat-token-reveal');
const patTokenValue = document.querySelector('#pat-token-value');
const copyPatTokenButton = document.querySelector('#copy-pat-token-button');

const projectId = getProjectIdFromPath();
const state = {
  project: null,
  personalAccessTokens: [],
  createdPersonalAccessToken: null
};

if (projectId !== null) {
  configureProjectNavigation(projectId);
  bindEvents();
  await loadPage();
}

function bindEvents() {
  if (createPatForm instanceof HTMLFormElement) {
    createPatForm.addEventListener('submit', handleCreatePersonalAccessToken);
  }

  if (copyPatTokenButton instanceof HTMLButtonElement) {
    copyPatTokenButton.addEventListener('click', () => void copyCreatedPersonalAccessToken());
  }
}

async function loadPage(options = {}) {
  clearMessage();
  setStatus('Loading personal access tokens...');

  if (!options.preserveCreatedToken) {
    state.createdPersonalAccessToken = null;
  }

  try {
    const [project, personalAccessTokenBody] = await Promise.all([
      apiRequest(`/api/projects/${projectId}`),
      apiRequest(`/api/projects/${projectId}/pats`)
    ]);
    state.project = project;
    state.personalAccessTokens = Array.isArray(personalAccessTokenBody?.items)
      ? personalAccessTokenBody.items
      : [];
    renderProjectChrome(project, 'PATs');
    renderPersonalAccessTokens();
  } catch (error) {
    handleError(error, 'Unable to load personal access tokens.');
  }
}

async function handleCreatePersonalAccessToken(event) {
  event.preventDefault();

  if (!(createPatForm instanceof HTMLFormElement) || !createPatForm.reportValidity()) {
    return;
  }

  const payload = {
    name: getFormValue(createPatForm, 'name'),
    expiresAt: new Date(getFormValue(createPatForm, 'expiresAt')).toISOString()
  };
  const button = createPatForm.querySelector('button[type="submit"]');
  setSubmitting(button, true, 'Create token', 'Creating...');
  clearMessage();

  try {
    const personalAccessToken = await apiRequest(`/api/projects/${projectId}/pats`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    createPatForm.reset();
    state.createdPersonalAccessToken = personalAccessToken.token;
    await loadPage({ preserveCreatedToken: true });
    showMessage(`Created ${personalAccessToken.name}.`, 'success');
  } catch (error) {
    handleError(error, 'Unable to create personal access token.');
  } finally {
    setSubmitting(button, false, 'Create token', 'Creating...');
  }
}

async function handleRevokePersonalAccessToken(personalAccessToken) {
  if (!window.confirm(`Revoke ${personalAccessToken.name}?`)) {
    return;
  }

  clearMessage();

  try {
    await apiRequest(`/api/projects/${projectId}/pats/${personalAccessToken.id}`, {
      method: 'DELETE'
    });
    state.createdPersonalAccessToken = null;
    await loadPage();
    showMessage(`Revoked ${personalAccessToken.name}.`, 'success');
  } catch (error) {
    handleError(error, 'Unable to revoke personal access token.');
  }
}

async function copyCreatedPersonalAccessToken() {
  if (typeof state.createdPersonalAccessToken !== 'string') {
    return;
  }

  try {
    if (navigator.clipboard === undefined) {
      throw new Error('Clipboard unavailable');
    }

    await navigator.clipboard.writeText(state.createdPersonalAccessToken);
    showMessage('Token copied.', 'success');
  } catch {
    showMessage('Unable to copy token automatically. Select and copy it manually.', 'error');
  }
}

function renderPersonalAccessTokens() {
  if (!(patList instanceof HTMLElement)) {
    return;
  }

  renderPersonalAccessTokenReveal();
  setPersonalAccessTokenDateLimits();
  patList.replaceChildren();

  if (state.personalAccessTokens.length === 0) {
    patList.append(createEmptyState('No active tokens.', 'Create a token for CLI access.'));
    return;
  }

  for (const personalAccessToken of state.personalAccessTokens) {
    const item = document.createElement('article');
    item.className = 'resource-item';

    const content = document.createElement('div');
    content.append(
      createElement('h3', '', personalAccessToken.name),
      createElement('p', 'resource-meta', `Owner ${personalAccessToken.userEmail}`),
      createElement(
        'p',
        'resource-meta',
        `Ends in ${personalAccessToken.tokenLastFour} · Expires ${formatDate(personalAccessToken.expiresAt)}${getTokenStatusText(personalAccessToken)}`
      )
    );

    const revokeButton = createButton('Revoke', 'button-danger button-small');
    revokeButton.addEventListener(
      'click',
      () => void handleRevokePersonalAccessToken(personalAccessToken)
    );

    item.append(content, revokeButton);
    patList.append(item);
  }
}

function renderPersonalAccessTokenReveal() {
  const hasToken = typeof state.createdPersonalAccessToken === 'string';

  setVisible(patTokenReveal, hasToken);
  setText(patTokenValue, hasToken ? state.createdPersonalAccessToken : '');
}

function setPersonalAccessTokenDateLimits() {
  if (!(createPatForm instanceof HTMLFormElement)) {
    return;
  }

  const expiresAtInput = createPatForm.querySelector('#pat-expires-at');

  if (!(expiresAtInput instanceof HTMLInputElement)) {
    return;
  }

  const now = new Date();
  const defaultExpiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const maximumExpiresAt = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  expiresAtInput.min = formatDateTimeLocal(now);
  expiresAtInput.max = formatDateTimeLocal(maximumExpiresAt);

  if (expiresAtInput.value.length === 0) {
    expiresAtInput.value = formatDateTimeLocal(defaultExpiresAt);
  }
}

function getTokenStatusText(personalAccessToken) {
  const expiresAt = new Date(personalAccessToken.expiresAt);

  if (expiresAt <= new Date()) {
    return ' · Expired';
  }

  if (personalAccessToken.lastUsedAt !== null) {
    return ` · Last used ${formatDate(personalAccessToken.lastUsedAt)}`;
  }

  return ' · Never used';
}
