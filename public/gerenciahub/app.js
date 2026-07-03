const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;
const MAX_UPLOAD_FILES = 500;
const UPLOAD_CONCURRENCY = 3;
const CACHE_TTL = 5 * 60 * 1000;

const state = {
  authenticated: false,
  user: null,
  repos: [],
  repoPage: 1,
  hasNextRepos: false,
  activeRepo: null,
  activeBranch: '',
  currentPath: '',
  files: [],
  activeFile: null,
  originalContent: '',
  currentContent: '',
  branches: [],
  fileIndex: [],
  fileIndexKey: '',
  searchSelection: 0,
  searchResults: [],
  dialogMode: 'create',
  uploadItems: [],
  uploadConflictPaths: new Set(),
  uploadBaseHeadSha: '',
  uploadBaseEmpty: false,
  uploadBusy: false,
  browserDragDepth: 0,
  loadingCount: 0
};

const elements = {
  app: $('#app'), authView: $('#authView'), workspace: $('#workspace'), userMenu: $('#userMenu'),
  userAvatar: $('#userAvatar'), userLogin: $('#userLogin'), logoutButton: $('#logoutButton'),
  oauthButton: $('#oauthButton'), oauthHint: $('#oauthHint'), tokenForm: $('#tokenForm'),
  tokenInput: $('#tokenInput'), rememberInput: $('#rememberInput'), tokenSubmitButton: $('#tokenSubmitButton'),
  toggleTokenButton: $('#toggleTokenButton'), connectionStatus: $('#connectionStatus'), themeButton: $('#themeButton'),
  repoSidebar: $('#repoSidebar'), sidebarBackdrop: $('#sidebarBackdrop'), mobileMenuButton: $('#mobileMenuButton'),
  mobileReposButton: $('#mobileReposButton'), newRepositoryButton: $('#newRepositoryButton'), refreshReposButton: $('#refreshReposButton'), repoSearchInput: $('#repoSearchInput'),
  repoList: $('#repoList'), loadMoreReposButton: $('#loadMoreReposButton'), emptyState: $('#emptyState'), repoView: $('#repoView'),
  repoTitle: $('#repoTitle'), repoVisibility: $('#repoVisibility'), repoDescription: $('#repoDescription'), branchSelect: $('#branchSelect'),
  quickSearchButton: $('#quickSearchButton'), newBranchButton: $('#newBranchButton'), pullRequestButton: $('#pullRequestButton'),
  openGithubLink: $('#openGithubLink'), newFileButton: $('#newFileButton'), uploadButton: $('#uploadButton'), breadcrumb: $('#breadcrumb'),
  fileCount: $('#fileCount'), fileList: $('#fileList'), editorEmpty: $('#editorEmpty'), editorContent: $('#editorContent'),
  activeFileIcon: $('#activeFileIcon'), activeFileName: $('#activeFileName'), activeFileMeta: $('#activeFileMeta'), dirtyBadge: $('#dirtyBadge'),
  copyButton: $('#copyButton'), organizeFileButton: $('#organizeFileButton'), deleteButton: $('#deleteButton'), textEditorArea: $('#textEditorArea'), binaryPreview: $('#binaryPreview'),
  fileEditor: $('#fileEditor'), lineNumbers: $('#lineNumbers'), highlightedCode: $('#highlightedCode'),
  editTabButton: $('#editTabButton'), previewTabButton: $('#previewTabButton'), editTab: $('#editTab'), previewTab: $('#previewTab'),
  commitBar: $('#commitBar'), commitMessageInput: $('#commitMessageInput'), saveButton: $('#saveButton'),
  fileDialog: $('#fileDialog'), fileForm: $('#fileForm'), fileDialogEyebrow: $('#fileDialogEyebrow'), fileDialogTitle: $('#fileDialogTitle'),
  newFilePathLabel: $('#newFilePathLabel'), newFilePath: $('#newFilePath'), newFilePathHelp: $('#newFilePathHelp'),
  uploadField: $('#uploadField'), uploadDropZone: $('#uploadDropZone'), uploadFilesInput: $('#uploadFilesInput'), uploadFolderInput: $('#uploadFolderInput'),
  selectUploadFilesButton: $('#selectUploadFilesButton'), selectUploadFolderButton: $('#selectUploadFolderButton'), clearUploadQueueButton: $('#clearUploadQueueButton'),
  uploadQueue: $('#uploadQueue'), uploadSummary: $('#uploadSummary'), uploadOverwrite: $('#uploadOverwrite'), uploadProgress: $('#uploadProgress'),
  uploadProgressBar: $('#uploadProgressBar'), uploadProgressText: $('#uploadProgressText'), newContentField: $('#newContentField'),
  newFileContent: $('#newFileContent'), newCommitMessage: $('#newCommitMessage'), confirmFileDialogButton: $('#confirmFileDialogButton'),
  cancelFileDialogButton: $('#cancelFileDialogButton'), confirmDialog: $('#confirmDialog'), confirmForm: $('#confirmForm'),
  confirmText: $('#confirmText'), deleteCommitMessage: $('#deleteCommitMessage'), cancelConfirmButton: $('#cancelConfirmButton'),
  repositoryDialog: $('#repositoryDialog'), repositoryForm: $('#repositoryForm'), repositoryName: $('#repositoryName'),
  repositoryDescription: $('#repositoryDescription'), repositoryVisibility: $('#repositoryVisibility'), repositoryAutoInit: $('#repositoryAutoInit'),
  cancelRepositoryButton: $('#cancelRepositoryButton'), confirmRepositoryButton: $('#confirmRepositoryButton'),
  branchDialog: $('#branchDialog'), branchForm: $('#branchForm'), branchName: $('#branchName'), branchSource: $('#branchSource'),
  cancelBranchButton: $('#cancelBranchButton'), confirmBranchButton: $('#confirmBranchButton'),
  pullRequestDialog: $('#pullRequestDialog'), pullRequestForm: $('#pullRequestForm'), pullHead: $('#pullHead'), pullBase: $('#pullBase'),
  pullTitle: $('#pullTitle'), pullBody: $('#pullBody'), pullDraft: $('#pullDraft'), cancelPullRequestButton: $('#cancelPullRequestButton'),
  confirmPullRequestButton: $('#confirmPullRequestButton'),
  fileOperationDialog: $('#fileOperationDialog'), fileOperationForm: $('#fileOperationForm'), fileOperationType: $('#fileOperationType'),
  fileOperationSource: $('#fileOperationSource'), fileOperationDestination: $('#fileOperationDestination'), fileOperationMessage: $('#fileOperationMessage'),
  cancelFileOperationButton: $('#cancelFileOperationButton'), confirmFileOperationButton: $('#confirmFileOperationButton'),
  quickSearchDialog: $('#quickSearchDialog'), quickSearchInput: $('#quickSearchInput'), quickSearchStatus: $('#quickSearchStatus'),
  quickSearchResults: $('#quickSearchResults'), closeQuickSearchButton: $('#closeQuickSearchButton'),
  fileBrowserPanel: $('#fileBrowserPanel'), browserDropOverlay: $('#browserDropOverlay'), browserDropTarget: $('#browserDropTarget'),
  toastRegion: $('#toastRegion'), globalLoader: $('#globalLoader')
};

class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

async function api(url, options = {}) {
  const config = { credentials: 'same-origin', ...options, headers: { ...options.headers } };
  if (config.body && typeof config.body !== 'string') {
    config.headers['Content-Type'] = 'application/json';
    config.body = JSON.stringify(config.body);
  }
  const response = await fetch(url, config);
  const type = response.headers.get('content-type') || '';
  const data = type.includes('application/json') ? await response.json().catch(() => ({})) : await response.text();
  if (!response.ok) {
    if (response.status === 401 && state.authenticated) await handleExpiredSession();
    throw new ApiError(data?.error || data?.message || `Erro ${response.status}`, response.status, data);
  }
  return data;
}

function cacheKey(type, suffix = '') {
  const user = state.user?.login || 'anonymous';
  return `ghfm:${user}:${type}:${suffix}`;
}

function setCache(key, value) {
  try { localStorage.setItem(key, JSON.stringify({ value, savedAt: Date.now() })); } catch { /* quota/private mode */ }
}

function getCache(key, ttl = CACHE_TTL) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.savedAt > ttl) return null;
    return parsed.value;
  } catch { return null; }
}

function removeCache(key) {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}

function setLoading(active) {
  state.loadingCount += active ? 1 : -1;
  state.loadingCount = Math.max(0, state.loadingCount);
  elements.globalLoader.classList.toggle('hidden', state.loadingCount === 0);
}

async function withLoading(task, { global = true } = {}) {
  if (global) setLoading(true);
  try { return await task(); }
  finally { if (global) setLoading(false); }
}

function toast(title, message = '', type = 'info', duration = 4600, action = null) {
  const item = document.createElement('div');
  item.className = `toast ${type}`;
  const icon = type === 'success' ? '✓' : type === 'error' ? '!' : 'i';
  item.innerHTML = `<b aria-hidden="true">${icon}</b><div><strong></strong><span></span><a class="toast-action hidden" target="_blank" rel="noreferrer"></a></div><button aria-label="Fechar">×</button>`;
  item.querySelector('strong').textContent = title;
  item.querySelector('span').textContent = message;
  if (action?.href) {
    const link = item.querySelector('.toast-action');
    link.href = action.href;
    link.textContent = action.label || 'Abrir';
    link.classList.remove('hidden');
  }
  item.querySelector('button').addEventListener('click', () => item.remove());
  elements.toastRegion.append(item);
  setTimeout(() => item.remove(), duration);
}

function showError(error, fallback = 'Não foi possível concluir a operação.') {
  console.error(error);
  toast('Algo deu errado', error?.message || fallback, 'error', 7000);
}

function setConnection(online) {
  elements.connectionStatus.classList.toggle('online', online);
  elements.connectionStatus.classList.toggle('offline', !online);
  elements.connectionStatus.lastChild.textContent = online ? ' Online' : ' Offline';
}

function formatBytes(bytes = 0) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
}

function extensionOf(filename = '') {
  const index = filename.lastIndexOf('.');
  return index >= 0 ? filename.slice(index + 1).toLowerCase() : '';
}

function fileLabel(filename) {
  const ext = extensionOf(filename);
  return (ext || 'txt').slice(0, 4).toUpperCase();
}

function isImageFile(filename) {
  return ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico'].includes(extensionOf(filename));
}

function normalizeUserPath(input) {
  return String(input || '').replaceAll('\\', '/').replace(/^\/+|\/+$/g, '').replace(/\/{2,}/g, '/');
}

function joinPath(...parts) {
  return normalizeUserPath(parts.filter(Boolean).join('/'));
}

function encodeParams(params) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== '' && value != null) search.set(key, value);
  });
  return search.toString();
}

function repoApiBase() {
  const { owner, name } = state.activeRepo;
  return `/api/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`;
}

function setAuthView(authenticated) {
  state.authenticated = authenticated;
  elements.app.dataset.authenticated = String(authenticated);
  elements.authView.classList.toggle('hidden', authenticated);
  elements.workspace.classList.toggle('hidden', !authenticated);
  elements.userMenu.classList.toggle('hidden', !authenticated);
  if (authenticated && state.user) {
    elements.userAvatar.src = state.user.avatarUrl;
    elements.userLogin.textContent = state.user.login;
  }
}

async function init() {
  initTheme();
  bindEvents();
  setConnection(navigator.onLine);
  try {
    const status = await api('/api/auth/status');
    elements.oauthButton.disabled = !status.oauthConfigured;
    elements.oauthHint.textContent = status.oauthConfigured
      ? 'Você será redirecionado ao GitHub para autorizar o acesso.'
      : 'OAuth não configurado no servidor; o login por token está disponível.';
    if (status.authenticated) {
      state.user = status.user;
      setAuthView(true);
      await loadRepos({ reset: true, preferCache: true });
    } else {
      setAuthView(false);
    }
  } catch (error) {
    setAuthView(false);
    showError(error, 'Não foi possível iniciar a aplicação.');
  }

  const params = new URLSearchParams(location.search);
  if (params.get('auth') === 'success') {
    history.replaceState({}, '', '/gerenciahub/');
    toast('Login concluído', 'Sua conta do GitHub foi conectada.', 'success');
  }
}

function initTheme() {
  const saved = localStorage.getItem('ghfm:theme');
  const preferred = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  document.documentElement.dataset.theme = saved || preferred;
}

function toggleTheme() {
  const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  document.documentElement.dataset.theme = next;
  localStorage.setItem('ghfm:theme', next);
}

function bindEvents() {
  $$('dialog .modal-header button[value="cancel"]').forEach((button) => {
    button.type = 'button';
    button.addEventListener('click', () => button.closest('dialog')?.close());
  });
  elements.themeButton.addEventListener('click', toggleTheme);
  elements.oauthButton.addEventListener('click', () => { location.href = '/api/auth/github'; });
  elements.toggleTokenButton.addEventListener('click', () => {
    const show = elements.tokenInput.type === 'password';
    elements.tokenInput.type = show ? 'text' : 'password';
    elements.toggleTokenButton.textContent = show ? 'Ocultar' : 'Mostrar';
  });
  elements.tokenForm.addEventListener('submit', loginWithToken);
  elements.logoutButton.addEventListener('click', logout);
  elements.newRepositoryButton.addEventListener('click', openRepositoryDialog);
  elements.repositoryForm.addEventListener('submit', createRepository);
  elements.cancelRepositoryButton.addEventListener('click', () => elements.repositoryDialog.close());
  elements.refreshReposButton.addEventListener('click', () => loadRepos({ reset: true, preferCache: false }));
  elements.loadMoreReposButton.addEventListener('click', () => loadRepos({ reset: false, preferCache: false }));
  elements.repoSearchInput.addEventListener('input', renderRepos);
  elements.branchSelect.addEventListener('change', async () => {
    if (!confirmDiscardChanges()) { elements.branchSelect.value = state.activeBranch; return; }
    state.activeBranch = elements.branchSelect.value;
    state.currentPath = '';
    invalidateFileIndex();
    clearEditor();
    await loadDirectory('', { preferCache: true });
  });
  elements.quickSearchButton.addEventListener('click', openQuickSearch);
  elements.newBranchButton.addEventListener('click', openBranchDialog);
  elements.branchForm.addEventListener('submit', createBranch);
  elements.cancelBranchButton.addEventListener('click', () => elements.branchDialog.close());
  elements.pullRequestButton.addEventListener('click', openPullRequestDialog);
  elements.pullRequestForm.addEventListener('submit', createPullRequest);
  elements.cancelPullRequestButton.addEventListener('click', () => elements.pullRequestDialog.close());
  elements.newFileButton.addEventListener('click', () => openFileDialog('create'));
  elements.uploadButton.addEventListener('click', () => openFileDialog('upload'));
  elements.fileForm.addEventListener('submit', submitFileDialog);
  elements.cancelFileDialogButton.addEventListener('click', () => elements.fileDialog.close());
  elements.selectUploadFilesButton.addEventListener('click', () => elements.uploadFilesInput.click());
  elements.selectUploadFolderButton.addEventListener('click', () => elements.uploadFolderInput.click());
  elements.uploadFilesInput.addEventListener('change', async () => {
    await addUploadFiles([...elements.uploadFilesInput.files].map((file) => ({ file, relativePath: file.name })));
    elements.uploadFilesInput.value = '';
  });
  elements.uploadFolderInput.addEventListener('change', async () => {
    await addUploadFiles([...elements.uploadFolderInput.files].map((file) => ({ file, relativePath: file.webkitRelativePath || file.name })));
    elements.uploadFolderInput.value = '';
  });
  elements.clearUploadQueueButton.addEventListener('click', clearUploadQueue);
  elements.newFilePath.addEventListener('input', () => {
    if (state.dialogMode === 'upload') updateUploadConflictPreview();
  });
  elements.uploadOverwrite.addEventListener('change', renderUploadQueue);
  elements.uploadDropZone.addEventListener('click', (event) => {
    if (!event.target.closest('button')) elements.uploadFilesInput.click();
  });
  elements.uploadDropZone.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      elements.uploadFilesInput.click();
    }
  });
  ['dragenter', 'dragover'].forEach((type) => elements.uploadDropZone.addEventListener(type, (event) => {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    event.stopPropagation();
    elements.uploadDropZone.classList.add('drag-active');
  }));
  elements.uploadDropZone.addEventListener('dragleave', (event) => {
    if (!elements.uploadDropZone.contains(event.relatedTarget)) elements.uploadDropZone.classList.remove('drag-active');
  });
  elements.uploadDropZone.addEventListener('drop', async (event) => {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    event.stopPropagation();
    elements.uploadDropZone.classList.remove('drag-active');
    await addUploadFiles(await collectDroppedFiles(event.dataTransfer));
  });
  elements.fileBrowserPanel.addEventListener('dragenter', (event) => {
    if (!isFileDrag(event) || !state.activeRepo) return;
    event.preventDefault();
    state.browserDragDepth += 1;
    elements.browserDropTarget.textContent = state.currentPath
      ? `Destino: ${state.currentPath}`
      : 'Destino: raiz do repositório';
    elements.browserDropOverlay.classList.remove('hidden');
  });
  elements.fileBrowserPanel.addEventListener('dragover', (event) => {
    if (!isFileDrag(event) || !state.activeRepo) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
  });
  elements.fileBrowserPanel.addEventListener('dragleave', (event) => {
    if (!isFileDrag(event)) return;
    state.browserDragDepth = Math.max(0, state.browserDragDepth - 1);
    if (state.browserDragDepth === 0) elements.browserDropOverlay.classList.add('hidden');
  });
  elements.fileBrowserPanel.addEventListener('drop', async (event) => {
    if (!isFileDrag(event) || !state.activeRepo) return;
    event.preventDefault();
    state.browserDragDepth = 0;
    elements.browserDropOverlay.classList.add('hidden');
    const dropped = await collectDroppedFiles(event.dataTransfer);
    openFileDialog('upload');
    await addUploadFiles(dropped);
  });
  elements.fileEditor.addEventListener('input', handleEditorInput);
  elements.fileEditor.addEventListener('scroll', syncLineNumbers);
  elements.fileEditor.addEventListener('keydown', handleEditorKeydown);
  elements.editTabButton.addEventListener('click', () => switchEditorTab('edit'));
  elements.previewTabButton.addEventListener('click', () => switchEditorTab('preview'));
  elements.copyButton.addEventListener('click', copyActiveContent);
  elements.organizeFileButton.addEventListener('click', openFileOperationDialog);
  elements.fileOperationType.addEventListener('change', updateFileOperationDefaults);
  elements.fileOperationForm.addEventListener('submit', submitFileOperation);
  elements.cancelFileOperationButton.addEventListener('click', () => elements.fileOperationDialog.close());
  elements.saveButton.addEventListener('click', saveActiveFile);
  elements.deleteButton.addEventListener('click', openDeleteDialog);
  elements.confirmForm.addEventListener('submit', deleteActiveFile);
  elements.cancelConfirmButton.addEventListener('click', () => elements.confirmDialog.close());
  [elements.mobileMenuButton, elements.mobileReposButton].forEach((button) => button.addEventListener('click', toggleSidebar));
  elements.sidebarBackdrop.addEventListener('click', closeSidebar);
  elements.closeQuickSearchButton.addEventListener('click', () => elements.quickSearchDialog.close());
  elements.quickSearchInput.addEventListener('input', () => {
    state.searchSelection = 0;
    renderQuickSearchResults();
  });
  elements.quickSearchInput.addEventListener('keydown', handleQuickSearchKeydown);
  window.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'p') {
      event.preventDefault();
      openQuickSearch();
    }
    if (event.key === 'Escape' && elements.quickSearchDialog.open) elements.quickSearchDialog.close();
  });
  elements.fileDialog.addEventListener('cancel', (event) => {
    if (state.uploadBusy) event.preventDefault();
  });
  window.addEventListener('dragover', (event) => {
    if (isFileDrag(event)) event.preventDefault();
  });
  window.addEventListener('drop', (event) => {
    if (isFileDrag(event)) event.preventDefault();
  });
  window.addEventListener('online', () => setConnection(true));
  window.addEventListener('offline', () => setConnection(false));
  window.addEventListener('beforeunload', (event) => {
    if (isDirty()) { event.preventDefault(); event.returnValue = ''; }
  });
}

async function loginWithToken(event) {
  event.preventDefault();
  elements.tokenSubmitButton.disabled = true;
  try {
    const result = await withLoading(() => api('/api/auth/token', {
      method: 'POST',
      body: { token: elements.tokenInput.value.trim(), remember: elements.rememberInput.checked }
    }));
    state.user = result.user;
    elements.tokenInput.value = '';
    setAuthView(true);
    toast('Conectado', `Olá, ${result.user.name || result.user.login}.`, 'success');
    await loadRepos({ reset: true, preferCache: true });
  } catch (error) { showError(error, 'Confira o token e suas permissões.'); }
  finally { elements.tokenSubmitButton.disabled = false; }
}

async function logout() {
  if (!confirmDiscardChanges()) return;
  try { await api('/api/auth/logout', { method: 'POST' }); } catch { /* clear local UI anyway */ }
  Object.assign(state, { authenticated: false, user: null, repos: [], activeRepo: null, activeFile: null });
  setAuthView(false);
  elements.repoList.replaceChildren();
  elements.repoView.classList.add('hidden');
  elements.emptyState.classList.remove('hidden');
  toast('Sessão encerrada', 'O token foi removido da sessão.', 'success');
}

async function handleExpiredSession() {
  Object.assign(state, { authenticated: false, user: null, activeRepo: null, activeFile: null });
  setAuthView(false);
  toast('Sessão expirada', 'Entre novamente para continuar.', 'error');
}

async function loadRepos({ reset, preferCache }) {
  if (reset) {
    state.repoPage = 1;
    state.repos = [];
    renderRepoSkeletons();
  }
  const key = cacheKey('repos', 'all');
  if (reset && preferCache) {
    const cached = getCache(key);
    if (cached?.items?.length) {
      state.repos = cached.items;
      state.hasNextRepos = cached.hasNext;
      renderRepos();
    }
  }

  try {
    const requestedPage = state.repoPage;
    const data = await api(`/api/repos?${encodeParams({ page: requestedPage, per_page: 100 })}`);
    const merged = reset ? data.items : [...state.repos, ...data.items];
    state.repos = [...new Map(merged.map((repo) => [repo.id, repo])).values()];
    state.hasNextRepos = data.hasNext;
    setCache(key, { items: state.repos, hasNext: state.hasNextRepos });
    renderRepos();
    state.repoPage = requestedPage + 1;
  } catch (error) {
    if (!state.repos.length) elements.repoList.innerHTML = '<p class="muted center">Não foi possível carregar os repositórios.</p>';
    showError(error);
  }
}

function renderRepoSkeletons() {
  elements.repoList.innerHTML = Array.from({ length: 7 }, () => '<div class="skeleton"></div>').join('');
}

function renderRepos() {
  const query = elements.repoSearchInput.value.trim().toLowerCase();
  const repos = state.repos.filter((repo) => !query || repo.fullName.toLowerCase().includes(query) || (repo.description || '').toLowerCase().includes(query));
  elements.repoList.replaceChildren();
  if (!repos.length) {
    const empty = document.createElement('p');
    empty.className = 'muted center';
    empty.textContent = query ? 'Nenhum repositório encontrado.' : 'Nenhum repositório disponível.';
    elements.repoList.append(empty);
  }
  for (const repo of repos) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `repo-item ${state.activeRepo?.id === repo.id ? 'active' : ''}`;
    button.innerHTML = `<strong></strong><span><b class="${repo.private ? 'private-dot' : ''}">${repo.private ? '● Privado' : '○ Público'}</b>${repo.language ? ` · ${escapeHtml(repo.language)}` : ''}</span>`;
    button.querySelector('strong').textContent = repo.fullName;
    button.addEventListener('click', () => selectRepo(repo));
    elements.repoList.append(button);
  }
  elements.loadMoreReposButton.classList.toggle('hidden', !state.hasNextRepos || Boolean(query));
}

function openRepositoryDialog() {
  elements.repositoryForm.reset();
  elements.repositoryVisibility.value = 'private';
  elements.repositoryAutoInit.checked = true;
  elements.repositoryDialog.showModal();
  setTimeout(() => elements.repositoryName.focus(), 30);
}

async function createRepository(event) {
  event.preventDefault();
  const name = elements.repositoryName.value.trim();
  if (!name) return;
  elements.confirmRepositoryButton.disabled = true;
  try {
    const repo = await withLoading(() => api('/api/repos', {
      method: 'POST',
      body: {
        name,
        description: elements.repositoryDescription.value.trim(),
        visibility: elements.repositoryVisibility.value,
        autoInit: elements.repositoryAutoInit.checked
      }
    }));
    elements.repositoryDialog.close();
    removeCache(cacheKey('repos', 'all'));
    state.repos = [repo, ...state.repos.filter((item) => item.id !== repo.id)];
    renderRepos();
    toast('Repositório criado', `${repo.fullName} está pronto para uso.`, 'success', 6500, { href: repo.htmlUrl, label: 'Abrir no GitHub' });
    await selectRepo(repo);
  } catch (error) {
    showError(error, 'Não foi possível criar o repositório. Verifique a permissão Administration do token.');
  } finally {
    elements.confirmRepositoryButton.disabled = false;
  }
}

async function selectRepo(repo) {
  if (state.activeRepo?.id === repo.id) { closeSidebar(); return; }
  if (!confirmDiscardChanges()) return;
  state.activeRepo = repo;
  state.activeBranch = repo.defaultBranch || '';
  state.currentPath = '';
  state.branches = [];
  invalidateFileIndex();
  clearEditor();
  renderRepos();
  closeSidebar();
  elements.emptyState.classList.add('hidden');
  elements.repoView.classList.remove('hidden');
  elements.repoTitle.textContent = repo.fullName;
  elements.repoVisibility.textContent = repo.private ? 'Privado' : 'Público';
  elements.repoDescription.textContent = repo.description || 'Sem descrição.';
  elements.openGithubLink.href = repo.htmlUrl;
  const canWrite = !repo.archived && repo.permissions?.push !== false;
  [elements.newBranchButton, elements.pullRequestButton, elements.newFileButton, elements.uploadButton].forEach((button) => {
    button.disabled = !canWrite;
  });
  await loadBranches();
  if (state.activeBranch) await loadDirectory('', { preferCache: true });
  else {
    state.files = [];
    renderBreadcrumb();
    renderFiles();
    toast('Repositório vazio', 'Inicialize o repositório no GitHub antes de gerenciar arquivos e branches.', 'info', 7000);
  }
}

async function loadBranches() {
  elements.branchSelect.replaceChildren();
  const loadingOption = document.createElement('option');
  loadingOption.textContent = 'Carregando...';
  elements.branchSelect.append(loadingOption);
  elements.branchSelect.disabled = true;
  try {
    const branches = await api(`${repoApiBase()}/branches`);
    state.branches = branches;
    elements.branchSelect.replaceChildren();
    if (!branches.length) {
      const option = document.createElement('option');
      option.textContent = 'Sem branches';
      option.value = '';
      elements.branchSelect.append(option);
      state.activeBranch = '';
      return;
    }
    if (!branches.some((item) => item.name === state.activeBranch)) {
      state.activeBranch = branches.some((item) => item.name === state.activeRepo.defaultBranch)
        ? state.activeRepo.defaultBranch
        : branches[0].name;
    }
    for (const branch of branches) {
      const option = document.createElement('option');
      option.value = branch.name;
      option.textContent = branch.name + (branch.protected ? ' 🔒' : '');
      option.selected = branch.name === state.activeBranch;
      elements.branchSelect.append(option);
    }
  } catch (error) {
    state.branches = [];
    showError(error, 'Não foi possível carregar as branches.');
  } finally {
    elements.branchSelect.disabled = state.branches.length === 0;
  }
}

function fillBranchSelect(select, selectedValue) {
  select.replaceChildren();
  for (const branch of state.branches) {
    const option = document.createElement('option');
    option.value = branch.name;
    option.textContent = branch.name + (branch.protected ? ' 🔒' : '');
    option.selected = branch.name === selectedValue;
    select.append(option);
  }
}

function openBranchDialog() {
  if (!state.activeRepo || !state.activeBranch) return;
  elements.branchForm.reset();
  fillBranchSelect(elements.branchSource, state.activeBranch);
  elements.branchDialog.showModal();
  setTimeout(() => elements.branchName.focus(), 30);
}

async function createBranch(event) {
  event.preventDefault();
  const name = elements.branchName.value.trim();
  const sourceBranch = elements.branchSource.value;
  if (!name || !sourceBranch) return;
  elements.confirmBranchButton.disabled = true;
  try {
    const branch = await withLoading(() => api(`${repoApiBase()}/branches`, {
      method: 'POST',
      body: { name, sourceBranch }
    }));
    elements.branchDialog.close();
    state.activeBranch = branch.name;
    state.currentPath = '';
    clearEditor();
    invalidateFileIndex();
    await loadBranches();
    elements.branchSelect.value = state.activeBranch;
    await loadDirectory('', { preferCache: false });
    toast('Branch criada', `${branch.name} foi criada a partir de ${sourceBranch}.`, 'success');
  } catch (error) {
    showError(error, 'Não foi possível criar a branch.');
  } finally {
    elements.confirmBranchButton.disabled = false;
  }
}

function openPullRequestDialog() {
  if (!state.activeRepo || state.branches.length < 2) {
    toast('Branches insuficientes', 'Crie uma nova branch antes de abrir um Pull Request.', 'info');
    return;
  }
  elements.pullRequestForm.reset();
  const base = state.branches.some((item) => item.name === state.activeRepo.defaultBranch)
    ? state.activeRepo.defaultBranch
    : state.branches[0].name;
  let head = state.activeBranch;
  if (!head || head === base) head = state.branches.find((item) => item.name !== base)?.name || '';
  fillBranchSelect(elements.pullHead, head);
  fillBranchSelect(elements.pullBase, base);
  elements.pullTitle.value = head ? `Mescla ${head} em ${base}` : '';
  elements.pullRequestDialog.showModal();
  setTimeout(() => elements.pullTitle.focus(), 30);
}

async function createPullRequest(event) {
  event.preventDefault();
  const head = elements.pullHead.value;
  const base = elements.pullBase.value;
  const title = elements.pullTitle.value.trim();
  if (!head || !base || !title) return;
  elements.confirmPullRequestButton.disabled = true;
  try {
    const pull = await withLoading(() => api(`${repoApiBase()}/pulls`, {
      method: 'POST',
      body: {
        head,
        base,
        title,
        body: elements.pullBody.value.trim(),
        draft: elements.pullDraft.checked
      }
    }));
    elements.pullRequestDialog.close();
    toast(
      'Pull Request criado',
      `#${pull.number}: ${pull.title}`,
      'success',
      9000,
      { href: pull.htmlUrl, label: 'Abrir Pull Request' }
    );
  } catch (error) {
    showError(error, 'Não foi possível criar o Pull Request. Confirme se existem commits diferentes entre as branches.');
  } finally {
    elements.confirmPullRequestButton.disabled = false;
  }
}

async function loadDirectory(pathValue, { preferCache = false } = {}) {
  const nextPath = normalizeUserPath(pathValue);
  const key = cacheKey('dir', `${state.activeRepo.fullName}:${state.activeBranch}:${nextPath}`);
  state.currentPath = nextPath;
  renderBreadcrumb();
  renderFileSkeletons();
  if (preferCache) {
    const cached = getCache(key);
    if (cached) { state.files = cached; renderFiles(); }
  }
  try {
    const data = await api(`${repoApiBase()}/contents?${encodeParams({ path: nextPath, ref: state.activeBranch })}`);
    state.files = data;
    setCache(key, data);
    renderFiles();
  } catch (error) {
    state.files = [];
    renderFiles();
    showError(error, 'Não foi possível abrir esta pasta.');
  }
}

function renderFileSkeletons() {
  elements.fileList.innerHTML = Array.from({ length: 8 }, () => '<div class="skeleton" style="margin:6px 10px"></div>').join('');
}

function renderFiles() {
  elements.fileList.replaceChildren();
  elements.fileCount.textContent = `${state.files.length} item${state.files.length === 1 ? '' : 's'}`;
  if (!state.files.length) {
    elements.fileList.innerHTML = '<p class="muted center" style="padding:24px">Pasta vazia.</p>';
    return;
  }
  for (const item of state.files) {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = `file-row ${state.activeFile?.path === item.path ? 'active' : ''}`;
    const isDir = item.type === 'dir';
    row.innerHTML = `<span class="item-icon">${isDir ? '▰' : '≡'}</span><span class="file-main"><strong></strong><small>${isDir ? 'Pasta' : formatBytes(item.size)}</small></span><span class="arrow">${isDir ? '›' : ''}</span>`;
    row.querySelector('strong').textContent = item.name;
    row.addEventListener('click', () => isDir ? openDirectory(item.path) : openFile(item));
    elements.fileList.append(row);
  }
}

async function openDirectory(pathValue) {
  if (!confirmDiscardChanges()) return;
  clearEditor();
  await loadDirectory(pathValue, { preferCache: true });
}

function renderBreadcrumb() {
  elements.breadcrumb.replaceChildren();
  const segments = state.currentPath ? state.currentPath.split('/') : [];
  const root = document.createElement('button');
  root.type = 'button';
  root.textContent = state.activeRepo?.name || 'Raiz';
  root.addEventListener('click', () => openDirectory(''));
  elements.breadcrumb.append(root);
  let accumulated = '';
  segments.forEach((segment) => {
    accumulated = joinPath(accumulated, segment);
    const target = accumulated;
    const divider = document.createElement('span');
    divider.textContent = '/';
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = segment;
    button.addEventListener('click', () => openDirectory(target));
    elements.breadcrumb.append(divider, button);
  });
}

async function openQuickSearch() {
  if (!state.activeRepo || !state.activeBranch) {
    toast('Selecione um repositório', 'A pesquisa rápida precisa de uma branch ativa.', 'info');
    return;
  }
  state.searchSelection = 0;
  state.searchResults = [];
  elements.quickSearchInput.value = '';
  elements.quickSearchResults.replaceChildren();
  elements.quickSearchStatus.textContent = 'Carregando índice da branch...';
  if (!elements.quickSearchDialog.open) elements.quickSearchDialog.showModal();
  setTimeout(() => elements.quickSearchInput.focus(), 30);
  try {
    await loadFileIndex();
    renderQuickSearchResults();
  } catch (error) {
    elements.quickSearchStatus.textContent = 'Não foi possível carregar o índice.';
    showError(error, 'Não foi possível pesquisar os arquivos.');
  }
}

async function loadFileIndex() {
  const indexKey = `${state.activeRepo.fullName}:${state.activeBranch}`;
  if (state.fileIndexKey === indexKey && state.fileIndex.length) return;
  const key = cacheKey('file-index', indexKey);
  const cached = getCache(key, 10 * 60 * 1000);
  let hasCachedIndex = false;
  if (cached?.items?.length) {
    hasCachedIndex = true;
    state.fileIndex = cached.items;
    state.fileIndexKey = indexKey;
    elements.quickSearchStatus.textContent = cached.truncated
      ? `${cached.items.length} caminhos indexados · resultado parcial do GitHub`
      : `${cached.items.length} caminhos indexados`;
    renderQuickSearchResults();
  }
  try {
    const data = await api(`${repoApiBase()}/file-index?${encodeParams({ ref: state.activeBranch })}`);
    state.fileIndex = data.items;
    state.fileIndexKey = indexKey;
    if (data.items.length <= 20000) setCache(key, data);
    elements.quickSearchStatus.textContent = data.truncated
      ? `${data.items.length} caminhos indexados · resultado parcial do GitHub`
      : `${data.items.length} caminhos indexados`;
  } catch (error) {
    if (!hasCachedIndex) throw error;
    elements.quickSearchStatus.textContent += ' · usando cache local';
  }
}

function searchScore(item, query) {
  const path = item.path.toLowerCase();
  const name = item.name.toLowerCase();
  if (!query) return item.type === 'file' ? 10 : 20;
  if (name === query) return 0;
  if (name.startsWith(query)) return 1;
  if (path.startsWith(query)) return 2;
  if (name.includes(query)) return 3;
  if (path.includes(query)) return 4;
  const tokens = query.split(/\s+/).filter(Boolean);
  if (tokens.every((token) => path.includes(token))) return 5;
  return Number.POSITIVE_INFINITY;
}

function renderQuickSearchResults() {
  const query = elements.quickSearchInput.value.trim().toLowerCase();
  state.searchResults = state.fileIndex
    .map((item) => ({ item, score: searchScore(item, query) }))
    .filter((entry) => Number.isFinite(entry.score))
    .sort((a, b) => a.score - b.score || a.item.path.length - b.item.path.length || a.item.path.localeCompare(b.item.path))
    .slice(0, 60)
    .map((entry) => entry.item);
  state.searchSelection = Math.min(state.searchSelection, Math.max(0, state.searchResults.length - 1));
  elements.quickSearchResults.replaceChildren();
  if (!state.searchResults.length) {
    elements.quickSearchResults.innerHTML = '<p class="muted center search-empty">Nenhum caminho encontrado.</p>';
    return;
  }
  state.searchResults.forEach((item, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `quick-search-result ${index === state.searchSelection ? 'selected' : ''}`;
    button.setAttribute('role', 'option');
    button.setAttribute('aria-selected', String(index === state.searchSelection));
    button.innerHTML = `<span class="item-icon">${item.type === 'dir' ? '▰' : '≡'}</span><span><strong></strong><small></small></span><em>${item.type === 'dir' ? 'Pasta' : formatBytes(item.size)}</em>`;
    button.querySelector('strong').textContent = item.name;
    button.querySelector('small').textContent = item.path;
    button.addEventListener('mouseenter', () => {
      state.searchSelection = index;
      updateQuickSearchSelection();
    });
    button.addEventListener('click', () => navigateToSearchResult(item));
    elements.quickSearchResults.append(button);
  });
}

function updateQuickSearchSelection() {
  const rows = [...elements.quickSearchResults.querySelectorAll('.quick-search-result')];
  rows.forEach((row, index) => {
    const selected = index === state.searchSelection;
    row.classList.toggle('selected', selected);
    row.setAttribute('aria-selected', String(selected));
  });
  rows[state.searchSelection]?.scrollIntoView({ block: 'nearest' });
}

function handleQuickSearchKeydown(event) {
  if (!state.searchResults.length) return;
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    state.searchSelection = (state.searchSelection + 1) % state.searchResults.length;
    updateQuickSearchSelection();
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    state.searchSelection = (state.searchSelection - 1 + state.searchResults.length) % state.searchResults.length;
    updateQuickSearchSelection();
  } else if (event.key === 'Enter') {
    event.preventDefault();
    navigateToSearchResult(state.searchResults[state.searchSelection]);
  }
}

async function navigateToSearchResult(item) {
  if (!item || !confirmDiscardChanges()) return;
  elements.quickSearchDialog.close();
  if (item.type === 'dir') {
    clearEditor();
    await loadDirectory(item.path, { preferCache: true });
    return;
  }
  const parent = item.path.includes('/') ? item.path.split('/').slice(0, -1).join('/') : '';
  clearEditor();
  await loadDirectory(parent, { preferCache: true });
  const listedItem = state.files.find((entry) => entry.path === item.path) || item;
  await openFile(listedItem);
}

async function openFile(item) {
  if (state.activeFile?.path === item.path) return;
  if (!confirmDiscardChanges()) return;
  elements.editorEmpty.classList.add('hidden');
  elements.editorContent.classList.remove('hidden');
  elements.activeFileName.textContent = item.name;
  elements.activeFileMeta.textContent = 'Carregando...';
  elements.fileEditor.value = '';
  elements.fileEditor.disabled = true;
  renderFiles();

  try {
    const data = await withLoading(() => api(`${repoApiBase()}/file?${encodeParams({ path: item.path, ref: state.activeBranch })}`));
    state.activeFile = { ...item, ...data };
    state.originalContent = data.content || '';
    const draftKey = cacheKey('draft', `${state.activeRepo.fullName}:${state.activeBranch}:${item.path}:${data.sha}`);
    const draft = getCache(draftKey, 7 * 24 * 60 * 60 * 1000);
    state.currentContent = draft?.content ?? state.originalContent;
    renderActiveFile(Boolean(draft && draft.content !== state.originalContent));
    renderFiles();
  } catch (error) {
    clearEditor();
    showError(error, 'Não foi possível abrir o arquivo.');
  }
}

function renderActiveFile(hasDraft = false) {
  const file = state.activeFile;
  elements.activeFileName.textContent = file.name;
  elements.activeFileMeta.textContent = `${formatBytes(file.size)} · ${state.activeBranch}`;
  elements.activeFileIcon.textContent = fileLabel(file.name);
  elements.commitMessageInput.value = '';
  const canWrite = !state.activeRepo?.archived && state.activeRepo?.permissions?.push !== false;
  elements.deleteButton.disabled = !canWrite;
  elements.organizeFileButton.disabled = !canWrite;
  elements.copyButton.disabled = file.tooLarge;

  if (file.tooLarge) {
    elements.textEditorArea.classList.add('hidden');
    elements.commitBar.classList.add('hidden');
    elements.binaryPreview.classList.remove('hidden');
    elements.binaryPreview.innerHTML = `<div><h3>Arquivo grande demais para o editor</h3><p>O limite de leitura desta instalação é ${formatBytes(file.maxReadableBytes)}.</p>${file.downloadUrl ? `<a href="${escapeHtml(file.downloadUrl)}" target="_blank" rel="noreferrer">Baixar arquivo</a>` : ''}</div>`;
    updateDirtyUi();
    return;
  }

  if (file.isBinary) {
    elements.textEditorArea.classList.add('hidden');
    elements.commitBar.classList.add('hidden');
    elements.binaryPreview.classList.remove('hidden');
    if (isImageFile(file.name) && file.base64) {
      const img = document.createElement('img');
      img.alt = file.name;
      img.src = `data:${file.mimeType};base64,${file.base64}`;
      elements.binaryPreview.replaceChildren(img);
    } else {
      elements.binaryPreview.innerHTML = `<div><h3>Arquivo binário</h3><p>Este formato não pode ser editado como texto.</p>${file.downloadUrl ? `<a href="${escapeHtml(file.downloadUrl)}" target="_blank" rel="noreferrer">Baixar arquivo</a>` : ''}</div>`;
    }
    updateDirtyUi();
    return;
  }

  elements.textEditorArea.classList.remove('hidden');
  elements.commitBar.classList.remove('hidden');
  elements.binaryPreview.classList.add('hidden');
  elements.fileEditor.disabled = false;
  elements.fileEditor.value = state.currentContent;
  updateLineNumbers();
  renderHighlight();
  updateDirtyUi();
  if (hasDraft) toast('Rascunho restaurado', 'Uma alteração local não confirmada foi recuperada.', 'info');
}

function clearEditor() {
  state.activeFile = null;
  state.originalContent = '';
  state.currentContent = '';
  elements.editorEmpty.classList.remove('hidden');
  elements.editorContent.classList.add('hidden');
  elements.dirtyBadge.classList.add('hidden');
  renderFiles();
}

function handleEditorInput() {
  state.currentContent = elements.fileEditor.value;
  updateLineNumbers();
  renderHighlight();
  updateDirtyUi();
  if (state.activeFile) {
    const key = cacheKey('draft', `${state.activeRepo.fullName}:${state.activeBranch}:${state.activeFile.path}:${state.activeFile.sha}`);
    if (isDirty()) setCache(key, { content: state.currentContent });
    else removeCache(key);
  }
}

function handleEditorKeydown(event) {
  if (event.key === 'Tab') {
    event.preventDefault();
    const { selectionStart, selectionEnd, value } = elements.fileEditor;
    elements.fileEditor.value = `${value.slice(0, selectionStart)}  ${value.slice(selectionEnd)}`;
    elements.fileEditor.selectionStart = elements.fileEditor.selectionEnd = selectionStart + 2;
    handleEditorInput();
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
    event.preventDefault();
    saveActiveFile();
  }
}

function updateLineNumbers() {
  const lines = Math.max(1, elements.fileEditor.value.split('\n').length);
  elements.lineNumbers.textContent = Array.from({ length: lines }, (_, index) => index + 1).join('\n');
}

function syncLineNumbers() {
  elements.lineNumbers.scrollTop = elements.fileEditor.scrollTop;
}

function isDirty() {
  return Boolean(state.activeFile && !state.activeFile.isBinary && !state.activeFile.tooLarge && state.currentContent !== state.originalContent);
}

function updateDirtyUi() {
  const dirty = isDirty();
  const canWrite = !state.activeRepo?.archived && state.activeRepo?.permissions?.push !== false;
  elements.dirtyBadge.classList.toggle('hidden', !dirty);
  elements.saveButton.disabled = !dirty || !canWrite;
}

function confirmDiscardChanges() {
  return !isDirty() || confirm('Existem alterações não confirmadas. Deseja descartá-las?');
}

function switchEditorTab(tab) {
  const preview = tab === 'preview';
  elements.editTabButton.classList.toggle('active', !preview);
  elements.previewTabButton.classList.toggle('active', preview);
  elements.editTab.classList.toggle('active', !preview);
  elements.previewTab.classList.toggle('active', preview);
  if (preview) renderHighlight();
}

function renderHighlight() {
  if (!state.activeFile) return;
  elements.highlightedCode.innerHTML = highlightCode(state.currentContent, extensionOf(state.activeFile.name));
}

function protectTokens(source, rules) {
  const tokens = [];
  let text = escapeHtml(source);
  for (const [className, regex] of rules) {
    text = text.replace(regex, (match) => {
      const id = tokens.push(`<span class="${className}">${match}</span>`) - 1;
      if (id >= 0x1900) return match;
      return String.fromCharCode(0xE000 + id);
    });
  }
  return text.replace(/[\uE000-\uF8FF]/g, (marker) => tokens[marker.charCodeAt(0) - 0xE000] ?? marker);
}

function highlightCode(source, extension) {
  const common = [
    ['token-comment', /(\/\*[\s\S]*?\*\/|\/\/[^\n]*|#[^\n]*)/g],
    ['token-string', /(&quot;(?:\\.|[^&])*?&quot;|'(?:\\.|[^'])*?'|`(?:\\.|[^`])*?`)/g],
    ['token-number', /\b\d+(?:\.\d+)?\b/g],
    ['token-bool', /\b(?:true|false|null|undefined)\b/g]
  ];
  if (['html', 'htm', 'xml', 'svg'].includes(extension)) {
    return protectTokens(source, [
      ['token-comment', /&lt;!--[\s\S]*?--&gt;/g],
      ['token-string', /&quot;.*?&quot;|'[^']*'/g],
      ['token-tag', /&lt;\/?[A-Za-z][^&]*?&gt;/g]
    ]);
  }
  if (['md', 'markdown'].includes(extension)) {
    return protectTokens(source, [
      ['token-title', /^#{1,6} .*$/gm],
      ['token-string', /`[^`]+`|\*\*[^*]+\*\*/g],
      ['token-comment', /^&gt;.*$/gm]
    ]);
  }
  if (['css', 'scss', 'less'].includes(extension)) {
    return protectTokens(source, [
      ['token-comment', /\/\*[\s\S]*?\*\//g],
      ['token-string', /&quot;.*?&quot;|'[^']*'/g],
      ['token-attr', /[-\w]+(?=\s*:)/g],
      ['token-number', /\b\d+(?:\.\d+)?(?:px|rem|em|%|vh|vw|s)?\b/g]
    ]);
  }
  if (['js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs', 'json', 'java', 'kt', 'py', 'php', 'rb', 'go', 'rs', 'c', 'cpp', 'cs', 'sh', 'yml', 'yaml'].includes(extension)) {
    return protectTokens(source, [
      ...common,
      ['token-keyword', /\b(?:const|let|var|function|return|if|else|for|while|switch|case|break|continue|class|extends|new|this|async|await|try|catch|finally|throw|import|export|from|default|interface|type|public|private|protected|static|void|int|float|double|string|boolean|def|lambda|in|is|not|and|or|package|fun|val|when|object|struct|enum|match|use|fn|impl)\b/g]
    ]);
  }
  return escapeHtml(source);
}

async function copyActiveContent() {
  if (!state.activeFile) return;
  try {
    const text = state.activeFile.isBinary ? state.activeFile.downloadUrl || '' : state.currentContent;
    await navigator.clipboard.writeText(text);
    toast('Copiado', state.activeFile.isBinary ? 'Link de download copiado.' : 'Conteúdo copiado.', 'success');
  } catch (error) { showError(error, 'Não foi possível copiar.'); }
}

function copiedPath(pathValue) {
  const parts = pathValue.split('/');
  const filename = parts.pop();
  const dot = filename.lastIndexOf('.');
  const copyName = dot > 0
    ? `${filename.slice(0, dot)}-copia${filename.slice(dot)}`
    : `${filename}-copia`;
  return [...parts, copyName].filter(Boolean).join('/');
}

function openFileOperationDialog() {
  if (!state.activeFile) return;
  if (isDirty()) {
    const discard = confirm('Existem alterações não confirmadas. Deseja descartá-las antes de organizar este arquivo?');
    if (!discard) return;
    state.currentContent = state.originalContent;
    elements.fileEditor.value = state.originalContent;
    handleEditorInput();
  }
  elements.fileOperationForm.reset();
  elements.fileOperationType.value = 'rename';
  elements.fileOperationSource.value = state.activeFile.path;
  updateFileOperationDefaults();
  elements.fileOperationDialog.showModal();
  setTimeout(() => {
    elements.fileOperationDestination.focus();
    elements.fileOperationDestination.select();
  }, 30);
}

function updateFileOperationDefaults() {
  if (!state.activeFile) return;
  const type = elements.fileOperationType.value;
  const pathValue = state.activeFile.path;
  elements.fileOperationDestination.value = type === 'copy' ? copiedPath(pathValue) : pathValue;
  const verbs = { rename: 'Renomeia', move: 'Move', copy: 'Copia' };
  elements.fileOperationMessage.value = `${verbs[type]} ${state.activeFile.name}`;
}

async function submitFileOperation(event) {
  event.preventDefault();
  if (!state.activeFile) return;
  const selectedType = elements.fileOperationType.value;
  const operation = selectedType === 'copy' ? 'copy' : 'move';
  const sourcePath = state.activeFile.path;
  const destinationPath = normalizeUserPath(elements.fileOperationDestination.value);
  const message = elements.fileOperationMessage.value.trim();
  if (!destinationPath || !message) return;
  elements.confirmFileOperationButton.disabled = true;
  try {
    const result = await withLoading(() => api(`${repoApiBase()}/file-operation`, {
      method: 'POST',
      body: {
        operation,
        sourcePath,
        destinationPath,
        branch: state.activeBranch,
        message,
        sha: state.activeFile.sha
      }
    }));
    elements.fileOperationDialog.close();
    removeCache(cacheKey('draft', `${state.activeRepo.fullName}:${state.activeBranch}:${sourcePath}:${state.activeFile.sha}`));
    const sourceParent = sourcePath.includes('/') ? sourcePath.split('/').slice(0, -1).join('/') : '';
    const destinationParent = destinationPath.includes('/') ? destinationPath.split('/').slice(0, -1).join('/') : '';
    invalidateDirectory(sourceParent);
    invalidateDirectory(destinationParent);
    invalidateFileIndex();
    clearEditor();
    toast(
      operation === 'copy' ? 'Arquivo copiado' : selectedType === 'rename' ? 'Arquivo renomeado' : 'Arquivo movido',
      `Commit ${result.commit?.sha?.slice(0, 7) || ''} criado.`,
      'success',
      7000,
      result.commit?.htmlUrl ? { href: result.commit.htmlUrl, label: 'Abrir commit' } : null
    );
    await loadDirectory(destinationParent, { preferCache: false });
    const target = state.files.find((entry) => entry.path === destinationPath);
    if (target) await openFile(target);
  } catch (error) {
    showError(error, 'Não foi possível concluir a operação de arquivo.');
  } finally {
    elements.confirmFileOperationButton.disabled = false;
  }
}

async function saveActiveFile() {
  if (!state.activeFile || !isDirty()) return;
  const message = elements.commitMessageInput.value.trim();
  if (!message) {
    elements.commitMessageInput.focus();
    toast('Mensagem obrigatória', 'Informe uma mensagem para o commit.', 'error');
    return;
  }
  elements.saveButton.disabled = true;
  try {
    const result = await withLoading(() => api(`${repoApiBase()}/file`, {
      method: 'PUT',
      body: {
        path: state.activeFile.path,
        content: state.currentContent,
        contentEncoding: 'utf8',
        message,
        sha: state.activeFile.sha,
        branch: state.activeBranch
      }
    }));
    const oldDraftKey = cacheKey('draft', `${state.activeRepo.fullName}:${state.activeBranch}:${state.activeFile.path}:${state.activeFile.sha}`);
    removeCache(oldDraftKey);
    state.activeFile.sha = result.content?.sha || state.activeFile.sha;
    state.originalContent = state.currentContent;
    elements.commitMessageInput.value = '';
    invalidateCurrentDirectory();
    invalidateFileIndex();
    updateDirtyUi();
    toast('Arquivo salvo', `Commit ${result.commit?.sha?.slice(0, 7) || ''} criado com sucesso.`, 'success');
    await loadDirectory(state.currentPath, { preferCache: false });
  } catch (error) {
    if (error.status === 409 || error.status === 422) {
      toast('Conflito de versão', 'O arquivo mudou no GitHub. Reabra-o antes de salvar novamente.', 'error', 8000);
    } else showError(error);
  } finally { updateDirtyUi(); }
}

function isFileDrag(event) {
  return [...(event.dataTransfer?.types || [])].includes('Files');
}

function sanitizeRelativePath(input) {
  const value = normalizeUserPath(input);
  if (!value || value.length > 1024) return '';
  const segments = value.split('/');
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) return '';
  return segments.join('/');
}

function openFileDialog(mode) {
  state.dialogMode = mode;
  elements.fileForm.reset();
  const isUpload = mode === 'upload';
  elements.fileDialogEyebrow.textContent = isUpload ? 'Upload em lote' : 'Novo';
  elements.fileDialogTitle.textContent = isUpload ? 'Adicionar arquivos e pastas' : 'Criar arquivo';
  elements.confirmFileDialogButton.textContent = isUpload ? 'Enviar e confirmar' : 'Criar arquivo';
  elements.uploadField.classList.toggle('hidden', !isUpload);
  elements.newContentField.classList.toggle('hidden', isUpload);
  elements.newFilePathHelp.classList.toggle('hidden', !isUpload);
  elements.newFilePathLabel.textContent = isUpload ? 'Pasta de destino no repositório' : 'Caminho no repositório';
  elements.newFilePath.placeholder = isUpload ? 'Deixe vazio para usar a raiz' : 'pasta/arquivo.js';
  elements.newFilePath.required = !isUpload;
  elements.newFileContent.required = false;
  elements.newFilePath.value = isUpload ? state.currentPath : state.currentPath ? `${state.currentPath}/` : '';
  elements.newCommitMessage.value = isUpload ? 'Adiciona arquivos e pastas' : 'Cria novo arquivo';
  elements.uploadOverwrite.checked = false;
  elements.uploadProgress.classList.add('hidden');
  elements.uploadProgressBar.style.width = '0%';
  elements.uploadProgressText.textContent = 'Preparando upload...';
  if (isUpload) clearUploadQueue();
  if (!elements.fileDialog.open) elements.fileDialog.showModal();
  setTimeout(() => (isUpload ? elements.uploadDropZone : elements.newFilePath).focus(), 30);
}

function clearUploadQueue() {
  state.uploadItems = [];
  state.uploadConflictPaths = new Set();
  state.uploadBaseHeadSha = '';
  state.uploadBaseEmpty = false;
  renderUploadQueue();
}

async function addUploadFiles(entries) {
  if (!entries?.length) return;
  const known = new Set(state.uploadItems.map((item) => item.relativePath));
  let tooLarge = 0;
  let invalid = 0;
  let duplicate = 0;
  let limitReached = 0;

  for (const entry of entries) {
    const file = entry?.file;
    const relativePath = sanitizeRelativePath(entry?.relativePath || file?.webkitRelativePath || file?.name);
    if (!(file instanceof File) || !relativePath) {
      invalid += 1;
      continue;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      tooLarge += 1;
      continue;
    }
    if (known.has(relativePath)) {
      duplicate += 1;
      continue;
    }
    if (state.uploadItems.length >= MAX_UPLOAD_FILES) {
      limitReached += 1;
      continue;
    }
    known.add(relativePath);
    state.uploadItems.push({ file, relativePath });
  }

  state.uploadConflictPaths = new Set();
  renderUploadQueue();
  const warnings = [];
  if (tooLarge) warnings.push(`${tooLarge} acima de 3 MB`);
  if (duplicate) warnings.push(`${duplicate} duplicado(s)`);
  if (invalid) warnings.push(`${invalid} caminho(s) inválido(s)`);
  if (limitReached) warnings.push(`${limitReached} acima do limite de ${MAX_UPLOAD_FILES}`);
  if (warnings.length) toast('Alguns itens foram ignorados', warnings.join(' · '), 'info', 6500);
}

function renderUploadQueue() {
  const items = state.uploadItems;
  elements.uploadQueue.replaceChildren();
  const totalBytes = items.reduce((sum, item) => sum + item.file.size, 0);
  const folders = new Set(items.map((item) => item.relativePath.split('/').slice(0, -1).join('/')).filter(Boolean));
  elements.uploadSummary.textContent = items.length
    ? `${items.length} arquivo${items.length === 1 ? '' : 's'} · ${formatBytes(totalBytes)}${folders.size ? ` · ${folders.size} pasta${folders.size === 1 ? '' : 's'}` : ''}`
    : 'Nenhum arquivo selecionado.';
  elements.clearUploadQueueButton.classList.toggle('hidden', !items.length);
  elements.confirmFileDialogButton.disabled = state.uploadBusy || (state.dialogMode === 'upload' && !items.length);

  if (!items.length) {
    elements.uploadQueue.innerHTML = '<div class="upload-queue-empty">Selecione vários arquivos, uma pasta inteira ou arraste os itens para esta área.</div>';
    return;
  }

  const basePath = normalizeUserPath(elements.newFilePath.value);
  for (const item of items) {
    const fullPath = joinPath(basePath, item.relativePath);
    const conflict = state.uploadConflictPaths.has(fullPath);
    const row = document.createElement('div');
    row.className = `upload-queue-item ${conflict ? 'has-conflict' : ''}`;
    row.innerHTML = '<span class="upload-file-icon">≡</span><div><strong></strong><small></small></div><span class="upload-conflict hidden">Já existe</span><button type="button" aria-label="Remover arquivo">×</button>';
    row.querySelector('strong').textContent = item.relativePath;
    row.querySelector('small').textContent = formatBytes(item.file.size);
    row.querySelector('.upload-conflict').classList.toggle('hidden', !conflict || elements.uploadOverwrite.checked);
    const removeButton = row.querySelector('button');
    removeButton.disabled = state.uploadBusy;
    removeButton.addEventListener('click', () => {
      state.uploadItems = state.uploadItems.filter((candidate) => candidate.relativePath !== item.relativePath);
      state.uploadConflictPaths.delete(fullPath);
      renderUploadQueue();
    });
    elements.uploadQueue.append(row);
  }
}

function setUploadBusy(busy) {
  state.uploadBusy = busy;
  elements.confirmFileDialogButton.disabled = busy || !state.uploadItems.length;
  elements.cancelFileDialogButton.disabled = busy;
  elements.selectUploadFilesButton.disabled = busy;
  elements.selectUploadFolderButton.disabled = busy;
  elements.clearUploadQueueButton.disabled = busy;
  elements.newFilePath.disabled = busy;
  elements.newCommitMessage.disabled = busy;
  elements.uploadOverwrite.disabled = busy;
  elements.fileDialog.querySelectorAll('.modal-header button').forEach((button) => { button.disabled = busy; });
  renderUploadQueue();
}

function updateUploadProgress(completed, total, text) {
  const percent = total ? Math.round((completed / total) * 100) : 0;
  elements.uploadProgress.classList.remove('hidden');
  elements.uploadProgressBar.style.width = `${Math.min(100, percent)}%`;
  elements.uploadProgressText.textContent = text || `${completed} de ${total} arquivos enviados`;
}

function updateUploadConflictPreview(indexItems = state.fileIndex) {
  const existing = new Set((indexItems || []).filter((item) => item.type === 'file').map((item) => item.path));
  const basePath = normalizeUserPath(elements.newFilePath.value);
  state.uploadConflictPaths = new Set(
    state.uploadItems
      .map((item) => joinPath(basePath, item.relativePath))
      .filter((pathValue) => existing.has(pathValue))
  );
  renderUploadQueue();
}

async function collectDroppedFiles(dataTransfer) {
  const transferItems = [...(dataTransfer?.items || [])].filter((item) => item.kind === 'file');
  const entries = transferItems.map((item) => item.webkitGetAsEntry?.()).filter(Boolean);
  if (entries.length) {
    const collected = [];
    for (const entry of entries) await walkDroppedEntry(entry, '', collected);
    return collected;
  }
  return [...(dataTransfer?.files || [])].map((file) => ({
    file,
    relativePath: file.webkitRelativePath || file.name
  }));
}

async function walkDroppedEntry(entry, parentPath, output) {
  const relativePath = joinPath(parentPath, entry.name);
  if (entry.isFile) {
    const file = await new Promise((resolve, reject) => entry.file(resolve, reject));
    output.push({ file, relativePath });
    return;
  }
  if (!entry.isDirectory) return;
  const reader = entry.createReader();
  const children = [];
  while (true) {
    const batch = await new Promise((resolve, reject) => reader.readEntries(resolve, reject));
    if (!batch.length) break;
    children.push(...batch);
  }
  children.sort((a, b) => a.name.localeCompare(b.name));
  for (const child of children) await walkDroppedEntry(child, relativePath, output);
}

async function mapUploadConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function submitFileDialog(event) {
  event.preventDefault();
  if (state.dialogMode === 'upload') {
    await submitBatchUpload();
    return;
  }

  const pathValue = normalizeUserPath(elements.newFilePath.value);
  const message = elements.newCommitMessage.value.trim();
  if (!pathValue || !message) return;
  elements.confirmFileDialogButton.disabled = true;
  try {
    const result = await withLoading(() => api(`${repoApiBase()}/file`, {
      method: 'PUT',
      body: {
        path: pathValue,
        content: elements.newFileContent.value,
        contentEncoding: 'utf8',
        message,
        branch: state.activeBranch
      }
    }));
    elements.fileDialog.close();
    invalidateCurrentDirectory();
    invalidateFileIndex();
    toast('Arquivo criado', `Commit ${result.commit?.sha?.slice(0, 7) || ''} criado.`, 'success');
    const parent = pathValue.includes('/') ? pathValue.split('/').slice(0, -1).join('/') : '';
    await loadDirectory(parent, { preferCache: false });
    const item = state.files.find((entry) => entry.path === pathValue);
    if (item && !item.type.includes('dir')) await openFile(item);
  } catch (error) {
    showError(error);
  } finally {
    elements.confirmFileDialogButton.disabled = false;
  }
}

async function submitBatchUpload() {
  const destination = normalizeUserPath(elements.newFilePath.value);
  const message = elements.newCommitMessage.value.trim();
  if (!state.uploadItems.length) {
    toast('Selecione arquivos', 'Adicione arquivos ou uma pasta antes de continuar.', 'error');
    return;
  }
  if (!message) {
    elements.newCommitMessage.focus();
    toast('Mensagem obrigatória', 'Informe uma mensagem para o commit.', 'error');
    return;
  }

  const descriptors = state.uploadItems.map((item) => ({
    ...item,
    path: joinPath(destination, item.relativePath)
  }));
  const uniquePaths = new Set(descriptors.map((item) => item.path));
  if (uniquePaths.size !== descriptors.length) {
    toast('Caminhos duplicados', 'Dois ou mais arquivos resultaram no mesmo caminho de destino.', 'error');
    return;
  }

  setUploadBusy(true);
  try {
    updateUploadProgress(0, descriptors.length, 'Verificando a branch e os arquivos existentes...');
    const indexData = await api(`${repoApiBase()}/file-index?${encodeParams({ ref: state.activeBranch })}`);
    state.fileIndex = indexData.items;
    state.fileIndexKey = `${state.activeRepo.fullName}:${state.activeBranch}`;
    state.uploadBaseHeadSha = indexData.headSha;
    state.uploadBaseEmpty = Boolean(indexData.empty);
    updateUploadConflictPreview(indexData.items);
    if (state.uploadConflictPaths.size && !elements.uploadOverwrite.checked) {
      throw new ApiError(
        `${state.uploadConflictPaths.size} arquivo(s) já existem no destino. Marque “Substituir arquivos” ou remova os conflitos.`,
        409,
        { details: { conflicts: [...state.uploadConflictPaths] } }
      );
    }

    let completed = 0;
    const blobs = await mapUploadConcurrency(descriptors, UPLOAD_CONCURRENCY, async (item) => {
      updateUploadProgress(completed, descriptors.length, `Preparando ${item.relativePath}...`);
      const content = await fileToBase64(item.file);
      const blob = await api(`${repoApiBase()}/upload/blob`, {
        method: 'POST',
        body: { content }
      });
      completed += 1;
      updateUploadProgress(completed, descriptors.length, `${completed} de ${descriptors.length} arquivos enviados`);
      return { path: item.path, sha: blob.sha };
    });

    updateUploadProgress(descriptors.length, descriptors.length, 'Criando um único commit com todos os arquivos...');
    const result = await api(`${repoApiBase()}/upload/commit`, {
      method: 'POST',
      body: {
        branch: state.activeBranch,
        message,
        overwrite: elements.uploadOverwrite.checked,
        baseHeadSha: state.uploadBaseHeadSha,
        baseWasEmpty: state.uploadBaseEmpty,
        files: blobs
      }
    });

    elements.fileDialog.close();
    invalidateDirectory(destination);
    invalidateCurrentDirectory();
    invalidateFileIndex();
    clearUploadQueue();
    const initializationNote = result.initialized ? ' O repositório vazio também foi inicializado automaticamente.' : '';
    toast(
      'Upload concluído',
      `${result.uploaded} arquivo${result.uploaded === 1 ? '' : 's'} confirmado${result.uploaded === 1 ? '' : 's'} no commit ${result.commit?.sha?.slice(0, 7) || ''}.${initializationNote}`,
      'success',
      9000,
      result.commit?.htmlUrl ? { href: result.commit.htmlUrl, label: 'Abrir commit' } : null
    );
    await loadDirectory(destination, { preferCache: false });
  } catch (error) {
    const conflicts = error?.data?.details?.conflicts;
    if (Array.isArray(conflicts)) {
      state.uploadConflictPaths = new Set(conflicts);
      renderUploadQueue();
    }
    showError(error, 'Não foi possível enviar os arquivos.');
  } finally {
    setUploadBusy(false);
  }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(reader.error || new Error('Falha ao ler o arquivo.'));
    reader.readAsDataURL(file);
  });
}

function openDeleteDialog() {
  if (!state.activeFile) return;
  elements.confirmText.textContent = `O arquivo “${state.activeFile.path}” será removido da branch “${state.activeBranch}”.`;
  elements.deleteCommitMessage.value = `Remove ${state.activeFile.name}`;
  elements.confirmDialog.showModal();
  setTimeout(() => elements.deleteCommitMessage.focus(), 30);
}

async function deleteActiveFile(event) {
  event.preventDefault();
  if (!state.activeFile) return;
  const message = elements.deleteCommitMessage.value.trim();
  if (!message) return;
  const deletedPath = state.activeFile.path;
  try {
    const result = await withLoading(() => api(`${repoApiBase()}/file`, {
      method: 'DELETE',
      body: { path: deletedPath, sha: state.activeFile.sha, message, branch: state.activeBranch }
    }));
    elements.confirmDialog.close();
    clearEditor();
    invalidateCurrentDirectory();
    invalidateFileIndex();
    toast('Arquivo excluído', `Commit ${result.commit?.sha?.slice(0, 7) || ''} criado.`, 'success');
    await loadDirectory(state.currentPath, { preferCache: false });
  } catch (error) { showError(error); }
}

function invalidateDirectory(pathValue) {
  if (!state.activeRepo) return;
  removeCache(cacheKey('dir', `${state.activeRepo.fullName}:${state.activeBranch}:${normalizeUserPath(pathValue)}`));
}

function invalidateCurrentDirectory() {
  invalidateDirectory(state.currentPath);
}

function invalidateFileIndex() {
  if (state.activeRepo && state.activeBranch) {
    removeCache(cacheKey('file-index', `${state.activeRepo.fullName}:${state.activeBranch}`));
  }
  state.fileIndex = [];
  state.fileIndexKey = '';
  state.searchResults = [];
}

function toggleSidebar() {
  const open = !elements.repoSidebar.classList.contains('open');
  elements.repoSidebar.classList.toggle('open', open);
  elements.sidebarBackdrop.classList.toggle('open', open);
}

function closeSidebar() {
  elements.repoSidebar.classList.remove('open');
  elements.sidebarBackdrop.classList.remove('open');
}

init();
