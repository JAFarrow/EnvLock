import {
  apiRequest,
  clearMessage,
  configureProjectNavigation,
  createButton,
  createElement,
  createEmptyState,
  createRoleOption,
  formatDate,
  formatRole,
  getFormValue,
  getProjectIdFromPath,
  handleError,
  renderProjectChrome,
  setStatus,
  setSubmitting,
  setVisible,
  showMessage
} from './project-page.js';

const memberList = document.querySelector('#member-list');
const addMemberForm = document.querySelector('#add-member-form');

const projectId = getProjectIdFromPath();
const state = {
  project: null,
  members: []
};

if (projectId !== null) {
  configureProjectNavigation(projectId);
  bindEvents();
  await loadPage();
}

function bindEvents() {
  if (addMemberForm instanceof HTMLFormElement) {
    addMemberForm.addEventListener('submit', handleAddMember);
  }
}

async function loadPage() {
  clearMessage();
  setStatus('Loading roles...');

  try {
    const [project, memberBody] = await Promise.all([
      apiRequest(`/api/projects/${projectId}`),
      apiRequest(`/api/projects/${projectId}/members`)
    ]);
    state.project = project;
    state.members = Array.isArray(memberBody?.items) ? memberBody.items : [];
    renderProjectChrome(project, 'Roles');
    renderMembers();
  } catch (error) {
    handleError(error, 'Unable to load roles.');
  }
}

async function handleAddMember(event) {
  event.preventDefault();

  if (!(addMemberForm instanceof HTMLFormElement) || !addMemberForm.reportValidity()) {
    return;
  }

  const payload = {
    email: getFormValue(addMemberForm, 'email'),
    role: getFormValue(addMemberForm, 'role')
  };
  const button = addMemberForm.querySelector('button[type="submit"]');
  setSubmitting(button, true, 'Add member', 'Adding...');
  clearMessage();

  try {
    const member = await apiRequest(`/api/projects/${projectId}/members`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    addMemberForm.reset();
    await loadPage();
    showMessage(`Added ${member.email}.`, 'success');
  } catch (error) {
    handleError(error, 'Unable to add member.');
  } finally {
    setSubmitting(button, false, 'Add member', 'Adding...');
  }
}

async function handleUpdateMemberRole(member, role) {
  if (role === member.role) {
    return;
  }

  clearMessage();

  try {
    await apiRequest(`/api/projects/${projectId}/members/${member.userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ role })
    });
    await loadPage();
    showMessage(`Updated ${member.email}.`, 'success');
  } catch (error) {
    handleError(error, 'Unable to update member role.');
    await loadPage();
  }
}

async function handleRemoveMember(member) {
  if (!window.confirm(`Revoke access for ${member.email}?`)) {
    return;
  }

  clearMessage();

  try {
    await apiRequest(`/api/projects/${projectId}/members/${member.userId}`, {
      method: 'DELETE'
    });
    await loadPage();
    showMessage(`Revoked ${member.email}.`, 'success');
  } catch (error) {
    handleError(error, 'Unable to revoke member.');
  }
}

function renderMembers() {
  if (!(memberList instanceof HTMLElement) || state.project === null) {
    return;
  }

  const canManage = state.project.role === 'owner';
  setVisible(addMemberForm, canManage);
  memberList.replaceChildren();

  if (state.members.length === 0) {
    memberList.append(createEmptyState('No members found.', 'Project members will appear here.'));
    return;
  }

  for (const member of state.members) {
    const item = document.createElement('article');
    item.className = 'resource-item member-item';

    const content = document.createElement('div');
    content.append(
      createElement('h3', '', member.email),
      createElement('p', 'resource-meta', `Joined ${formatDate(member.createdAt)}`)
    );
    item.append(content);

    if (canManage && member.role !== 'owner') {
      const controls = document.createElement('div');
      controls.className = 'inline-actions';

      const select = document.createElement('select');
      select.setAttribute('aria-label', `Role for ${member.email}`);
      select.append(
        createRoleOption('developer', member.role),
        createRoleOption('maintainer', member.role)
      );
      select.addEventListener('change', () => void handleUpdateMemberRole(member, select.value));

      const removeButton = createButton('Revoke', 'button-danger button-small');
      removeButton.addEventListener('click', () => void handleRemoveMember(member));
      controls.append(select, removeButton);
      item.append(controls);
    } else {
      item.append(createElement('span', 'badge muted-badge', formatRole(member.role)));
    }

    memberList.append(item);
  }
}
