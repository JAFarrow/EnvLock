import {
  apiRequest,
  clearMessage,
  compactPayload,
  configureProjectNavigation,
  createButton,
  createElement,
  createEmptyState,
  getFormValue,
  getProjectIdFromPath,
  handleError,
  renderProjectChrome,
  setStatus,
  setSubmitting,
  setVisible,
  showMessage
} from './project-page.js';

const environmentList = document.querySelector('#environment-list');
const createEnvironmentForm = document.querySelector('#create-environment-form');

const projectId = getProjectIdFromPath();
const state = {
  project: null,
  environments: []
};

if (projectId !== null) {
  configureProjectNavigation(projectId);
  bindEvents();
  await loadPage();
}

function bindEvents() {
  if (createEnvironmentForm instanceof HTMLFormElement) {
    createEnvironmentForm.addEventListener('submit', handleCreateEnvironment);
  }
}

async function loadPage() {
  clearMessage();
  setStatus('Loading environments...');

  try {
    const [project, environmentBody] = await Promise.all([
      apiRequest(`/api/projects/${projectId}`),
      apiRequest(`/api/projects/${projectId}/environments`)
    ]);
    state.project = project;
    state.environments = Array.isArray(environmentBody?.items) ? environmentBody.items : [];
    renderProjectChrome(project, 'Environments');
    renderEnvironments();
  } catch (error) {
    handleError(error, 'Unable to load environments.');
  }
}

async function handleCreateEnvironment(event) {
  event.preventDefault();

  if (
    !(createEnvironmentForm instanceof HTMLFormElement) ||
    !createEnvironmentForm.reportValidity()
  ) {
    return;
  }

  const payload = compactPayload({
    name: getFormValue(createEnvironmentForm, 'name'),
    slug: getFormValue(createEnvironmentForm, 'slug'),
    description: getFormValue(createEnvironmentForm, 'description')
  });
  const button = createEnvironmentForm.querySelector('button[type="submit"]');
  setSubmitting(button, true, 'Create environment', 'Creating...');
  clearMessage();

  try {
    const environment = await apiRequest(`/api/projects/${projectId}/environments`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    createEnvironmentForm.reset();
    await loadPage();
    showMessage(`Created ${environment.name}.`, 'success');
  } catch (error) {
    handleError(error, 'Unable to create environment.');
  } finally {
    setSubmitting(button, false, 'Create environment', 'Creating...');
  }
}

async function handleDeleteEnvironment(environment) {
  if (!window.confirm(`Delete ${environment.name}? This archives the environment.`)) {
    return;
  }

  clearMessage();

  try {
    await apiRequest(`/api/projects/${projectId}/environments/${environment.id}`, {
      method: 'DELETE'
    });
    await loadPage();
    showMessage(`Deleted ${environment.name}.`, 'success');
  } catch (error) {
    handleError(error, 'Unable to delete environment.');
  }
}

function renderEnvironments() {
  if (!(environmentList instanceof HTMLElement) || state.project === null) {
    return;
  }

  const canManage = ['owner', 'maintainer'].includes(state.project.role);
  setVisible(createEnvironmentForm, canManage);
  environmentList.replaceChildren();

  if (state.environments.length === 0) {
    environmentList.append(
      createEmptyState('No environments yet.', getEnvironmentEmptyText(canManage))
    );
    return;
  }

  for (const environment of state.environments) {
    const item = document.createElement('article');
    item.className = 'resource-item';

    const content = document.createElement('div');
    const environmentLink = document.createElement('a');
    environmentLink.href = `/projects/${projectId}/environments/${environment.id}`;
    environmentLink.textContent = environment.name;

    const title = document.createElement('h3');
    title.append(environmentLink);

    content.append(
      title,
      createElement('p', 'resource-meta', environment.slug),
      createElement('p', '', environment.description || 'No description provided.')
    );
    item.append(content);

    const actions = document.createElement('div');
    actions.className = 'inline-actions';

    const manageLink = document.createElement('a');
    manageLink.className = 'button-link';
    manageLink.href = `/projects/${projectId}/environments/${environment.id}`;
    manageLink.textContent = 'Manage secrets';
    actions.append(manageLink);

    if (canManage) {
      const button = createButton('Delete', 'button-danger button-small');
      button.addEventListener('click', () => void handleDeleteEnvironment(environment));
      actions.append(button);
    }

    item.append(actions);

    environmentList.append(item);
  }
}

function getEnvironmentEmptyText(canManage) {
  return canManage
    ? 'Create an environment from the form on this page.'
    : 'Owners and maintainers can create environments.';
}
