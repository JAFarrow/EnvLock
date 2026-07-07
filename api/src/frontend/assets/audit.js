import {
  apiRequest,
  clearMessage,
  configureProjectNavigation,
  createElement,
  createEmptyState,
  formatDateTime,
  getProjectIdFromPath,
  handleError,
  renderProjectChrome,
  setStatus
} from './project-page.js';

const auditList = document.querySelector('#audit-list');

const projectId = getProjectIdFromPath();
const state = {
  project: null,
  auditEvents: []
};

if (projectId !== null) {
  configureProjectNavigation(projectId);
  await loadPage();
}

async function loadPage() {
  clearMessage();
  setStatus('Loading audit events...');

  try {
    const [project, auditBody] = await Promise.all([
      apiRequest(`/api/projects/${projectId}`),
      apiRequest(`/api/projects/${projectId}/audit-events`)
    ]);

    state.project = project;
    state.auditEvents = Array.isArray(auditBody?.items) ? auditBody.items : [];
    renderProjectChrome(project, 'Audit');
    renderAuditEvents();
  } catch (error) {
    handleError(error, 'Unable to load audit events.');
  }
}

function renderAuditEvents() {
  if (!(auditList instanceof HTMLElement)) {
    return;
  }

  auditList.replaceChildren();

  if (state.auditEvents.length === 0) {
    auditList.append(
      createEmptyState('No audit events yet.', 'Sensitive project activity will appear here.')
    );
    return;
  }

  for (const auditEvent of state.auditEvents) {
    auditList.append(createAuditEventItem(auditEvent));
  }
}

function createAuditEventItem(auditEvent) {
  const item = document.createElement('details');
  item.className = 'resource-item audit-item';

  const summary = document.createElement('summary');
  summary.className = 'audit-summary';

  const content = document.createElement('div');
  content.append(
    createElement('h3', '', auditEvent.summary),
    createElement('p', 'resource-meta', getAuditEventMeta(auditEvent))
  );

  summary.append(content, createElement('span', 'badge muted-badge', auditEvent.action));

  const details = document.createElement('pre');
  details.className = 'audit-details';
  details.textContent = JSON.stringify(getDisplayDetails(auditEvent), null, 2);

  item.append(summary, details);
  return item;
}

function getAuditEventMeta(auditEvent) {
  return [
    formatDateTime(auditEvent.createdAt),
    auditEvent.actorEmail,
    getEnvironmentName(auditEvent)
  ]
    .filter((part) => part.length > 0)
    .join(' · ');
}

function getEnvironmentName(auditEvent) {
  const environmentName = auditEvent.details?.environmentName;

  if (typeof environmentName === 'string' && environmentName.length > 0) {
    return environmentName;
  }

  return '';
}

function getDisplayDetails(auditEvent) {
  return {
    environmentId: auditEvent.environmentId,
    targetType: auditEvent.targetType,
    targetId: auditEvent.targetId,
    details: auditEvent.details
  };
}
