import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const GITHUB_API = (process.env.GITHUB_API_URL || 'https://api.github.com').replace(/\/$/, '');
const API_VERSION = process.env.GITHUB_API_VERSION || '2026-03-10';
const MAX_WRITE_BYTES = 3 * 1024 * 1024;
const MAX_READ_BYTES = 5 * 1024 * 1024;
const MAX_BATCH_FILES = 500;
const INTERNAL_INIT_PATH = '.github-file-manager-init';
const COOKIE_SESSION = 'ghfm_session';
const COOKIE_STATE = 'ghfm_oauth_state';
const COOKIE_VERIFIER = 'ghfm_oauth_verifier';

app.disable('x-powered-by');
app.use(express.json({ limit: '6mb' }));
app.use(express.urlencoded({ extended: false, limit: '64kb' }));
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

// Em hospedagens comuns o Express serve o frontend. Na Vercel, public/** é servido pelo CDN.
if (!process.env.VERCEL) {
  app.use(express.static(path.join(__dirname, 'public')));
}

// Fallback para deploys em que a raiz chega à Function Express.
// Na Vercel, /index.html continua sendo servido pelo CDN a partir de public/.
app.get('/', (req, res, next) => {
  if (process.env.VERCEL) return res.redirect(307, '/index.html');
  next();
});

function getSessionSecret() {
  const value = process.env.SESSION_SECRET;
  if (value && value.length >= 24) return value;
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
    throw new Error('SESSION_SECRET ausente ou muito curta. Configure uma chave com pelo menos 24 caracteres.');
  }
  return 'desenvolvimento-local-altere-no-env-123456';
}

function encryptionKey() {
  return crypto.createHash('sha256').update(getSessionSecret()).digest();
}

function encrypt(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map((part) => part.toString('base64url')).join('.');
}

function decrypt(value) {
  try {
    const [ivRaw, tagRaw, dataRaw] = String(value || '').split('.');
    if (!ivRaw || !tagRaw || !dataRaw) return null;
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      encryptionKey(),
      Buffer.from(ivRaw, 'base64url')
    );
    decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'));
    const decoded = Buffer.concat([
      decipher.update(Buffer.from(dataRaw, 'base64url')),
      decipher.final()
    ]).toString('utf8');
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

function parseCookies(req) {
  const header = req.headers.cookie || '';
  return Object.fromEntries(
    header
      .split(';')
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => {
        const index = item.indexOf('=');
        const key = index >= 0 ? item.slice(0, index) : item;
        const value = index >= 0 ? item.slice(index + 1) : '';
        return [decodeURIComponent(key), decodeURIComponent(value)];
      })
  );
}

function isSecureRequest(req) {
  return req.secure || req.headers['x-forwarded-proto'] === 'https' || Boolean(process.env.VERCEL);
}

function setCookie(res, name, value, options = {}) {
  const parts = [`${encodeURIComponent(name)}=${encodeURIComponent(value)}`];
  parts.push(`Path=${options.path || '/'}`);
  if (options.httpOnly !== false) parts.push('HttpOnly');
  parts.push(`SameSite=${options.sameSite || 'Lax'}`);
  if (options.secure) parts.push('Secure');
  if (Number.isFinite(options.maxAge)) parts.push(`Max-Age=${Math.max(0, Math.floor(options.maxAge))}`);
  res.append('Set-Cookie', parts.join('; '));
}

function clearCookie(req, res, name) {
  setCookie(res, name, '', { maxAge: 0, secure: isSecureRequest(req) });
}

function setSession(req, res, token, remember = false) {
  const payload = encrypt({ token, issuedAt: Date.now() });
  setCookie(res, COOKIE_SESSION, payload, {
    secure: isSecureRequest(req),
    maxAge: remember ? 60 * 60 * 24 * 30 : undefined
  });
}

function getToken(req) {
  const cookies = parseCookies(req);
  const session = decrypt(cookies[COOKIE_SESSION]);
  return session?.token || null;
}

function requireAuth(req, res, next) {
  try {
    const token = getToken(req);
    if (!token) return res.status(401).json({ error: 'Não autenticado.', code: 'AUTH_REQUIRED' });
    req.githubToken = token;
    next();
  } catch (error) {
    next(error);
  }
}

function normalizePath(input, { allowEmpty = true } = {}) {
  const raw = String(input || '').replaceAll('\\', '/').replace(/^\/+|\/+$/g, '');
  if (!raw && allowEmpty) return '';
  if (!raw) throw httpError(400, 'Informe o caminho do arquivo.');
  const segments = raw.split('/');
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) {
    throw httpError(400, 'O caminho informado é inválido.');
  }
  return segments.join('/');
}

function encodeRepoPath(value) {
  return normalizePath(value).split('/').map(encodeURIComponent).join('/');
}

function validateOwnerRepo(owner, repo) {
  const safeOwner = String(owner || '').trim();
  const safeRepo = String(repo || '').trim();
  if (!/^[A-Za-z0-9_.-]+$/.test(safeOwner) || !/^[A-Za-z0-9_.-]+$/.test(safeRepo)) {
    throw httpError(400, 'Repositório inválido.');
  }
  return { owner: safeOwner, repo: safeRepo };
}

function normalizeBranchName(input) {
  const value = String(input || '').trim();
  if (!value || value.length > 240) throw httpError(400, 'Informe um nome de branch válido.');
  if (
    value.startsWith('/') || value.endsWith('/') || value.endsWith('.') ||
    value.includes('..') || value.includes('@{') || value.includes('//') ||
    /[\x00-\x20~^:?*\[\]\\]/.test(value)
  ) {
    throw httpError(400, 'O nome da branch contém caracteres inválidos.');
  }
  return value;
}

function encodeGitRef(value) {
  return normalizeBranchName(value).split('/').map(encodeURIComponent).join('/');
}

function validateRepositoryName(input) {
  const value = String(input || '').trim();
  if (!value || value.length > 100 || !/^[A-Za-z0-9._-]+$/.test(value)) {
    throw httpError(400, 'Use um nome de repositório com letras, números, ponto, hífen ou sublinhado.');
  }
  return value;
}

function mapRepository(repo) {
  return {
    id: repo.id,
    name: repo.name,
    fullName: repo.full_name,
    owner: repo.owner.login,
    private: repo.private,
    archived: repo.archived,
    defaultBranch: repo.default_branch || '',
    description: repo.description,
    language: repo.language,
    updatedAt: repo.updated_at,
    permissions: repo.permissions,
    htmlUrl: repo.html_url
  };
}

function httpError(status, message, details) {
  const error = new Error(message);
  error.status = status;
  error.details = details;
  return error;
}

async function parseGitHubResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json().catch(() => ({}));
  }
  return response.text().catch(() => '');
}

async function githubRequest(token, endpoint, options = {}) {
  let response;
  try {
    response = await fetch(`${GITHUB_API}${endpoint}`, {
      method: options.method || 'GET',
      headers: {
        Accept: options.accept || 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': API_VERSION,
        'User-Agent': 'github-file-manager-web',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: AbortSignal.timeout(options.timeout || 20000)
    });
  } catch (error) {
    if (error?.name === 'TimeoutError') throw error;
    throw httpError(502, 'Não foi possível conectar à API do GitHub.');
  }

  if (!response.ok) {
    const data = await parseGitHubResponse(response);
    const message = data?.message || data || `Erro do GitHub (${response.status}).`;
    const error = httpError(response.status, message, data);
    error.githubStatus = response.status;
    error.rateRemaining = response.headers.get('x-ratelimit-remaining');
    error.rateReset = response.headers.get('x-ratelimit-reset');
    throw error;
  }

  return response;
}

async function githubJson(token, endpoint, options = {}) {
  const response = await githubRequest(token, endpoint, options);
  if (response.status === 204) return null;
  return response.json();
}

async function getBranchHead(token, owner, repo, branch) {
  const data = await githubJson(
    token,
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/ref/heads/${encodeGitRef(branch)}`
  );
  return { sha: data.object.sha, ref: data.ref };
}

async function getBranchState(token, owner, repo, branch) {
  try {
    const head = await getBranchHead(token, owner, repo, branch);
    return { ...head, empty: false, defaultBranch: branch };
  } catch (error) {
    if (error.status !== 404) throw error;

    const branches = await githubJson(
      token,
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches?per_page=1`
    );
    if (Array.isArray(branches) && branches.length) throw error;

    const repository = await githubJson(
      token,
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`
    );
    return {
      sha: '',
      ref: `refs/heads/${repository.default_branch || branch || 'main'}`,
      empty: true,
      defaultBranch: repository.default_branch || branch || 'main'
    };
  }
}

async function initializeEmptyRepository(token, owner, repo, branch) {
  const state = await getBranchState(token, owner, repo, branch);
  if (!state.empty) return { initialized: false, head: state };
  if (branch !== state.defaultBranch) {
    const error = httpError(409, `Este repositório ainda está vazio. Faça o primeiro upload na branch padrão “${state.defaultBranch}”.`);
    error.code = 'EMPTY_REPOSITORY_DEFAULT_BRANCH';
    throw error;
  }

  const data = await githubJson(
    token,
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodeRepoPath(INTERNAL_INIT_PATH)}`,
    {
      method: 'PUT',
      body: {
        message: 'Inicializa o repositório para upload pelo GitHub File Manager',
        content: Buffer.from('GitHub File Manager initialization\n', 'utf8').toString('base64')
      }
    }
  );
  const head = await getBranchHead(token, owner, repo, branch);
  return { initialized: true, head, initializationCommit: data.commit?.sha || '' };
}

async function getCommitTree(token, owner, repo, commitSha) {
  const commit = await githubJson(
    token,
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/commits/${encodeURIComponent(commitSha)}`
  );
  return { commit, treeSha: commit.tree.sha };
}

async function pathExists(token, owner, repo, filePath, branch) {
  const params = branch ? `?ref=${encodeURIComponent(branch)}` : '';
  try {
    await githubJson(
      token,
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodeRepoPath(filePath)}${params}`
    );
    return true;
  } catch (error) {
    if (error.status === 404) return false;
    throw error;
  }
}

async function createTreeCommit(token, owner, repo, branch, message, entries, baseHeadSha = '') {
  const head = baseHeadSha ? { sha: baseHeadSha } : await getBranchHead(token, owner, repo, branch);
  const { treeSha } = await getCommitTree(token, owner, repo, head.sha);
  const tree = await githubJson(
    token,
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees`,
    { method: 'POST', body: { base_tree: treeSha, tree: entries } }
  );
  const commit = await githubJson(
    token,
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/commits`,
    { method: 'POST', body: { message, tree: tree.sha, parents: [head.sha] } }
  );
  await githubJson(
    token,
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/refs/heads/${encodeGitRef(branch)}`,
    { method: 'PATCH', body: { sha: commit.sha, force: false } }
  );
  return commit;
}

function decodeBase64Content(value) {
  const raw = String(value ?? '');
  if (raw.length > Math.ceil(MAX_WRITE_BYTES * 4 / 3) + 8) {
    throw httpError(413, `Cada arquivo pode ter no máximo ${Math.floor(MAX_WRITE_BYTES / 1024 / 1024)} MB nesta aplicação.`);
  }
  if (raw && (!/^[A-Za-z0-9+/]*={0,2}$/.test(raw) || raw.length % 4 === 1)) {
    throw httpError(400, 'Conteúdo Base64 inválido.');
  }
  const buffer = Buffer.from(raw, 'base64');
  const normalizedInput = raw.replace(/=+$/g, '');
  const normalizedOutput = buffer.toString('base64').replace(/=+$/g, '');
  if (normalizedInput !== normalizedOutput) throw httpError(400, 'Conteúdo Base64 inválido.');
  return buffer;
}

function parentPaths(filePath) {
  const parts = filePath.split('/');
  const result = [];
  for (let index = 1; index < parts.length; index += 1) {
    result.push(parts.slice(0, index).join('/'));
  }
  return result;
}

async function mapWithConcurrency(items, limit, mapper) {
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

async function validateToken(token) {
  if (!token || token.length < 20 || token.length > 500) {
    throw httpError(400, 'Token inválido.');
  }
  const user = await githubJson(token, '/user');
  return {
    login: user.login,
    name: user.name,
    avatarUrl: user.avatar_url,
    htmlUrl: user.html_url
  };
}

function buildAppUrl(req) {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, '');
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  return `${proto}://${req.get('host')}`;
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function randomVerifier() {
  return crypto.randomBytes(48).toString('base64url');
}

function pkceChallenge(verifier) {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

function looksBinary(buffer, filename = '') {
  const binaryExtensions = new Set([
    'png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'pdf', 'zip', 'gz', '7z', 'rar',
    'woff', 'woff2', 'ttf', 'otf', 'mp3', 'mp4', 'webm', 'mov', 'avi', 'exe', 'dll'
  ]);
  const extension = filename.includes('.') ? filename.split('.').pop().toLowerCase() : '';
  if (binaryExtensions.has(extension)) return true;
  const sample = buffer.subarray(0, Math.min(buffer.length, 8000));
  let suspicious = 0;
  for (const byte of sample) {
    if (byte === 0) return true;
    if (byte < 7 || (byte > 13 && byte < 32)) suspicious += 1;
  }
  return sample.length > 0 && suspicious / sample.length > 0.1;
}

function mimeFromFilename(filename = '') {
  const extension = filename.split('.').pop()?.toLowerCase();
  const types = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
    webp: 'image/webp', svg: 'image/svg+xml', ico: 'image/x-icon', pdf: 'application/pdf'
  };
  return types[extension] || 'application/octet-stream';
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true, apiVersion: API_VERSION, oauthConfigured: Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) });
});

app.get('/api/auth/status', async (req, res, next) => {
  try {
    const token = getToken(req);
    if (!token) {
      return res.json({ authenticated: false, oauthConfigured: Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) });
    }
    const user = await validateToken(token);
    res.json({ authenticated: true, user, oauthConfigured: Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) });
  } catch (error) {
    clearCookie(req, res, COOKIE_SESSION);
    if ([401, 403].includes(error.status)) {
      return res.json({ authenticated: false, oauthConfigured: Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) });
    }
    next(error);
  }
});

app.post('/api/auth/token', async (req, res, next) => {
  try {
    const token = String(req.body?.token || '').trim();
    const user = await validateToken(token);
    setSession(req, res, token, Boolean(req.body?.remember));
    res.json({ authenticated: true, user });
  } catch (error) {
    next(error);
  }
});

app.get('/api/auth/github', (req, res, next) => {
  try {
    const clientId = process.env.GITHUB_CLIENT_ID;
    if (!clientId || !process.env.GITHUB_CLIENT_SECRET) {
      throw httpError(503, 'OAuth não configurado. Use um token ou configure GITHUB_CLIENT_ID e GITHUB_CLIENT_SECRET.');
    }

    const state = crypto.randomBytes(24).toString('base64url');
    const verifier = randomVerifier();
    const secure = isSecureRequest(req);
    setCookie(res, COOKIE_STATE, state, { secure, maxAge: 600 });
    setCookie(res, COOKIE_VERIFIER, verifier, { secure, maxAge: 600 });

    const redirectUri = `${buildAppUrl(req)}/api/auth/callback`;
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: process.env.GITHUB_OAUTH_SCOPE || 'repo read:user',
      state,
      code_challenge: pkceChallenge(verifier),
      code_challenge_method: 'S256',
      allow_signup: 'true'
    });
    res.redirect(`https://github.com/login/oauth/authorize?${params}`);
  } catch (error) {
    next(error);
  }
});

app.get('/api/auth/callback', async (req, res, next) => {
  try {
    const cookies = parseCookies(req);
    const state = String(req.query.state || '');
    const code = String(req.query.code || '');
    const verifier = cookies[COOKIE_VERIFIER];

    if (!code || !safeEqual(state, cookies[COOKIE_STATE]) || !verifier) {
      throw httpError(400, 'Falha na validação do OAuth. Tente entrar novamente.');
    }

    const redirectUri = `${buildAppUrl(req)}/api/auth/callback`;
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'github-file-manager-web' },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: redirectUri,
        code_verifier: verifier
      }),
      signal: AbortSignal.timeout(20000)
    });
    const result = await response.json();
    if (!response.ok || result.error || !result.access_token) {
      throw httpError(401, result.error_description || result.error || 'Não foi possível concluir o OAuth.');
    }

    await validateToken(result.access_token);
    setSession(req, res, result.access_token, true);
    clearCookie(req, res, COOKIE_STATE);
    clearCookie(req, res, COOKIE_VERIFIER);
    res.redirect('/?auth=success');
  } catch (error) {
    next(error);
  }
});

app.post('/api/auth/logout', (req, res) => {
  clearCookie(req, res, COOKIE_SESSION);
  res.json({ ok: true });
});

app.post('/api/repos', requireAuth, async (req, res, next) => {
  try {
    const name = validateRepositoryName(req.body?.name);
    const description = String(req.body?.description || '').trim().slice(0, 350);
    const visibility = String(req.body?.visibility || 'private');
    const autoInit = req.body?.autoInit !== false;
    if (!['private', 'public'].includes(visibility)) throw httpError(400, 'Visibilidade inválida.');

    const data = await githubJson(req.githubToken, '/user/repos', {
      method: 'POST',
      body: {
        name,
        description: description || undefined,
        private: visibility === 'private',
        auto_init: autoInit
      }
    });
    res.status(201).json(mapRepository(data));
  } catch (error) {
    next(error);
  }
});

app.get('/api/repos', requireAuth, async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const perPage = Math.min(100, Math.max(1, Number(req.query.per_page || 100)));
    const params = new URLSearchParams({
      visibility: 'all',
      affiliation: 'owner,collaborator,organization_member',
      sort: 'updated',
      direction: 'desc',
      page: String(page),
      per_page: String(perPage)
    });
    const response = await githubRequest(req.githubToken, `/user/repos?${params}`);
    const data = await response.json();
    res.json({
      items: data.map(mapRepository),
      hasNext: /rel="next"/.test(response.headers.get('link') || '')
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/repos/:owner/:repo/branches', requireAuth, async (req, res, next) => {
  try {
    const { owner, repo } = validateOwnerRepo(req.params.owner, req.params.repo);
    const name = normalizeBranchName(req.body?.name);
    const sourceBranch = normalizeBranchName(req.body?.sourceBranch);
    if (name === sourceBranch) throw httpError(400, 'A nova branch precisa ter um nome diferente da branch de origem.');

    const source = await getBranchState(req.githubToken, owner, repo, sourceBranch);
    if (source.empty) {
      const error = httpError(409, 'Este repositório ainda está vazio. Envie pelo menos um arquivo antes de criar outra branch.');
      error.code = 'EMPTY_REPOSITORY';
      throw error;
    }
    const data = await githubJson(
      req.githubToken,
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/refs`,
      { method: 'POST', body: { ref: `refs/heads/${name}`, sha: source.sha } }
    );
    res.status(201).json({ name, sha: data.object.sha, ref: data.ref });
  } catch (error) {
    next(error);
  }
});

app.get('/api/repos/:owner/:repo/branches', requireAuth, async (req, res, next) => {
  try {
    const { owner, repo } = validateOwnerRepo(req.params.owner, req.params.repo);
    const data = await githubJson(req.githubToken, `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches?per_page=100`);
    res.json(data.map((branch) => ({ name: branch.name, protected: branch.protected, sha: branch.commit.sha })));
  } catch (error) {
    next(error);
  }
});

app.post('/api/repos/:owner/:repo/pulls', requireAuth, async (req, res, next) => {
  try {
    const { owner, repo } = validateOwnerRepo(req.params.owner, req.params.repo);
    const title = String(req.body?.title || '').trim();
    const body = String(req.body?.body || '').trim();
    const head = normalizeBranchName(req.body?.head);
    const base = normalizeBranchName(req.body?.base);
    const draft = Boolean(req.body?.draft);
    if (!title) throw httpError(400, 'Informe o título do Pull Request.');
    if (head === base) throw httpError(400, 'A branch de origem deve ser diferente da branch de destino.');

    const data = await githubJson(
      req.githubToken,
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls`,
      { method: 'POST', body: { title, body: body || undefined, head, base, draft } }
    );
    res.status(201).json({
      number: data.number,
      title: data.title,
      state: data.state,
      draft: data.draft,
      htmlUrl: data.html_url,
      head: data.head?.ref,
      base: data.base?.ref
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/repos/:owner/:repo/file-index', requireAuth, async (req, res, next) => {
  try {
    const { owner, repo } = validateOwnerRepo(req.params.owner, req.params.repo);
    const branch = normalizeBranchName(req.query.ref);
    const head = await getBranchState(req.githubToken, owner, repo, branch);
    if (head.empty) {
      return res.json({ items: [], truncated: false, branch: head.defaultBranch, headSha: '', empty: true });
    }
    const { treeSha } = await getCommitTree(req.githubToken, owner, repo, head.sha);
    const data = await githubJson(
      req.githubToken,
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(treeSha)}?recursive=1`
    );
    const items = (data.tree || [])
      .filter((entry) => (entry.type === 'blob' || entry.type === 'tree') && entry.path !== INTERNAL_INIT_PATH)
      .map((entry) => ({
        name: entry.path.split('/').pop(),
        path: entry.path,
        type: entry.type === 'tree' ? 'dir' : 'file',
        size: entry.size || 0,
        sha: entry.sha
      }));
    res.json({ items, truncated: Boolean(data.truncated), branch, headSha: head.sha, empty: false });
  } catch (error) {
    next(error);
  }
});

app.post('/api/repos/:owner/:repo/upload/blob', requireAuth, async (req, res, next) => {
  try {
    const { owner, repo } = validateOwnerRepo(req.params.owner, req.params.repo);
    const buffer = decodeBase64Content(req.body?.content);
    if (buffer.length > MAX_WRITE_BYTES) {
      throw httpError(413, `Cada arquivo pode ter no máximo ${Math.floor(MAX_WRITE_BYTES / 1024 / 1024)} MB nesta aplicação.`);
    }
    const data = await githubJson(
      req.githubToken,
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/blobs`,
      { method: 'POST', body: { content: buffer.toString('base64'), encoding: 'base64' } }
    );
    res.status(201).json({ sha: data.sha, size: buffer.length });
  } catch (error) {
    next(error);
  }
});

app.post('/api/repos/:owner/:repo/upload/commit', requireAuth, async (req, res, next) => {
  try {
    const { owner, repo } = validateOwnerRepo(req.params.owner, req.params.repo);
    const branch = normalizeBranchName(req.body?.branch);
    const message = String(req.body?.message || '').trim();
    const overwrite = Boolean(req.body?.overwrite);
    const expectedHeadSha = String(req.body?.baseHeadSha || '').trim();
    const baseWasEmpty = Boolean(req.body?.baseWasEmpty);
    const rawFiles = Array.isArray(req.body?.files) ? req.body.files : [];
    if (!message) throw httpError(400, 'Informe a mensagem do commit.');
    if (!rawFiles.length) throw httpError(400, 'Selecione pelo menos um arquivo.');
    if (rawFiles.length > MAX_BATCH_FILES) {
      throw httpError(413, `Envie no máximo ${MAX_BATCH_FILES} arquivos por operação.`);
    }

    const seenPaths = new Set();
    const files = rawFiles.map((item) => {
      const filePath = normalizePath(item?.path, { allowEmpty: false });
      const sha = String(item?.sha || '').trim();
      if (filePath === INTERNAL_INIT_PATH) {
        throw httpError(400, `O caminho “${INTERNAL_INIT_PATH}” é reservado para inicialização interna.`);
      }
      if (!/^[0-9a-f]{40,64}$/i.test(sha)) throw httpError(400, `SHA inválido para “${filePath}”.`);
      if (seenPaths.has(filePath)) throw httpError(400, `O caminho “${filePath}” aparece mais de uma vez.`);
      seenPaths.add(filePath);
      return { path: filePath, sha };
    });

    let head = await getBranchState(req.githubToken, owner, repo, branch);
    if (baseWasEmpty && !head.empty) {
      const error = httpError(409, 'O repositório recebeu o primeiro commit durante o upload. Atualize a pasta e tente novamente.');
      error.code = 'BRANCH_CHANGED';
      throw error;
    }
    if (expectedHeadSha && (head.empty || expectedHeadSha !== head.sha)) {
      const error = httpError(409, 'A branch recebeu novas alterações durante o upload. Atualize a pasta e tente novamente.');
      error.code = 'BRANCH_CHANGED';
      throw error;
    }

    let initialized = false;
    let initializationCommit = '';
    if (head.empty) {
      const result = await initializeEmptyRepository(req.githubToken, owner, repo, branch);
      initialized = result.initialized;
      initializationCommit = result.initializationCommit;
      head = result.head;
    }

    const { treeSha } = await getCommitTree(req.githubToken, owner, repo, head.sha);
    const treeData = await githubJson(
      req.githubToken,
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(treeSha)}?recursive=1`
    );

    const conflicts = [];
    const structuralConflicts = [];
    let hasInitPlaceholder = false;
    if (!treeData.truncated) {
      const existing = new Map((treeData.tree || []).map((entry) => [entry.path, entry.type]));
      hasInitPlaceholder = existing.get(INTERNAL_INIT_PATH) === 'blob';
      for (const file of files) {
        const exactType = existing.get(file.path);
        if (exactType === 'tree') structuralConflicts.push(file.path);
        else if (exactType && !overwrite) conflicts.push(file.path);
        for (const parent of parentPaths(file.path)) {
          const parentType = existing.get(parent);
          if (parentType && parentType !== 'tree') structuralConflicts.push(parent);
        }
      }
    } else {
      hasInitPlaceholder = await pathExists(req.githubToken, owner, repo, INTERNAL_INIT_PATH, head.sha);
      if (!overwrite) {
        const checks = await mapWithConcurrency(files, 5, async (file) => ({
          path: file.path,
          exists: await pathExists(req.githubToken, owner, repo, file.path, head.sha)
        }));
        conflicts.push(...checks.filter((item) => item.exists).map((item) => item.path));
      }
    }

    const uniqueStructural = [...new Set(structuralConflicts)];
    if (uniqueStructural.length) {
      const error = httpError(409, 'Um arquivo existente impede a criação de uma das pastas selecionadas.');
      error.code = 'UPLOAD_PATH_CONFLICT';
      error.publicDetails = { conflicts: uniqueStructural.slice(0, 30) };
      throw error;
    }
    if (conflicts.length) {
      const uniqueConflicts = [...new Set(conflicts)];
      const error = httpError(409, `${uniqueConflicts.length} arquivo(s) já existem no destino. Marque a opção de substituir para continuar.`);
      error.code = 'UPLOAD_CONFLICT';
      error.publicDetails = { conflicts: uniqueConflicts.slice(0, 50), total: uniqueConflicts.length };
      throw error;
    }

    const entries = files.map((file) => ({ path: file.path, mode: '100644', type: 'blob', sha: file.sha }));
    if (hasInitPlaceholder) {
      entries.push({ path: INTERNAL_INIT_PATH, mode: '100644', type: 'blob', sha: null });
    }
    const commit = await createTreeCommit(req.githubToken, owner, repo, branch, message, entries, head.sha);
    res.status(201).json({
      uploaded: files.length,
      branch,
      initialized,
      initializationCommit: initializationCommit || undefined,
      commit: { sha: commit.sha, htmlUrl: commit.html_url, message: commit.message }
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/repos/:owner/:repo/file-operation', requireAuth, async (req, res, next) => {
  try {
    const { owner, repo } = validateOwnerRepo(req.params.owner, req.params.repo);
    const operation = String(req.body?.operation || '').trim();
    const sourcePath = normalizePath(req.body?.sourcePath, { allowEmpty: false });
    const destinationPath = normalizePath(req.body?.destinationPath, { allowEmpty: false });
    const branch = normalizeBranchName(req.body?.branch);
    const message = String(req.body?.message || '').trim();
    const expectedSha = String(req.body?.sha || '').trim();
    if (!['copy', 'move'].includes(operation)) throw httpError(400, 'Operação de arquivo inválida.');
    if (!message) throw httpError(400, 'Informe a mensagem do commit.');
    if (sourcePath === destinationPath) throw httpError(400, 'O caminho de destino deve ser diferente do caminho atual.');

    const head = await getBranchHead(req.githubToken, owner, repo, branch);
    const params = `?ref=${encodeURIComponent(head.sha)}`;
    const source = await githubJson(
      req.githubToken,
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodeRepoPath(sourcePath)}${params}`
    );
    if (source.type !== 'file') throw httpError(400, 'Apenas arquivos podem ser movidos ou copiados nesta versão.');
    if (expectedSha && source.sha !== expectedSha) throw httpError(409, 'O arquivo foi alterado no GitHub. Reabra-o e tente novamente.');
    if (await pathExists(req.githubToken, owner, repo, destinationPath, head.sha)) {
      throw httpError(409, 'Já existe um arquivo ou pasta no caminho de destino.');
    }

    const entries = [
      { path: destinationPath, mode: '100644', type: 'blob', sha: source.sha }
    ];
    if (operation === 'move') {
      entries.push({ path: sourcePath, mode: '100644', type: 'blob', sha: null });
    }
    const commit = await createTreeCommit(req.githubToken, owner, repo, branch, message, entries, head.sha);
    res.json({
      operation,
      sourcePath,
      destinationPath,
      commit: { sha: commit.sha, htmlUrl: commit.html_url, message: commit.message }
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/repos/:owner/:repo/contents', requireAuth, async (req, res, next) => {
  try {
    const { owner, repo } = validateOwnerRepo(req.params.owner, req.params.repo);
    const repoPath = normalizePath(req.query.path || '');
    const ref = String(req.query.ref || '').trim();
    const endpointPath = repoPath ? `/${encodeRepoPath(repoPath)}` : '';
    const params = ref ? `?ref=${encodeURIComponent(ref)}` : '';
    let data;
    try {
      data = await githubJson(
        req.githubToken,
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents${endpointPath}${params}`
      );
    } catch (error) {
      if (error.status !== 404) throw error;
      const state = await getBranchState(req.githubToken, owner, repo, ref || 'main');
      if (!state.empty) throw error;
      data = [];
    }
    if (!Array.isArray(data)) throw httpError(400, 'O caminho informado não é um diretório.');
    const visibleItems = data.filter((item) => item.path !== INTERNAL_INIT_PATH);
    const order = { dir: 0, file: 1, symlink: 2, submodule: 3 };
    visibleItems.sort((a, b) => (order[a.type] ?? 9) - (order[b.type] ?? 9) || a.name.localeCompare(b.name));
    res.json(visibleItems.map((item) => ({
      name: item.name,
      path: item.path,
      type: item.type,
      size: item.size,
      sha: item.sha,
      htmlUrl: item.html_url,
      downloadUrl: item.download_url
    })));
  } catch (error) {
    next(error);
  }
});

app.get('/api/repos/:owner/:repo/file', requireAuth, async (req, res, next) => {
  try {
    const { owner, repo } = validateOwnerRepo(req.params.owner, req.params.repo);
    const filePath = normalizePath(req.query.path, { allowEmpty: false });
    const ref = String(req.query.ref || '').trim();
    const params = ref ? `?ref=${encodeURIComponent(ref)}` : '';
    const baseEndpoint = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodeRepoPath(filePath)}${params}`;
    const metadata = await githubJson(req.githubToken, baseEndpoint, { accept: 'application/vnd.github.object+json' });
    if (metadata.type !== 'file') throw httpError(400, 'O caminho informado não é um arquivo.');

    if (metadata.size > MAX_READ_BYTES) {
      return res.json({
        name: metadata.name,
        path: metadata.path,
        sha: metadata.sha,
        size: metadata.size,
        htmlUrl: metadata.html_url,
        downloadUrl: metadata.download_url,
        tooLarge: true,
        maxReadableBytes: MAX_READ_BYTES
      });
    }

    let buffer;
    if (metadata.encoding === 'base64' && metadata.content) {
      buffer = Buffer.from(metadata.content.replace(/\n/g, ''), 'base64');
    } else {
      const rawResponse = await githubRequest(req.githubToken, baseEndpoint, { accept: 'application/vnd.github.raw+json' });
      buffer = Buffer.from(await rawResponse.arrayBuffer());
    }

    const binary = looksBinary(buffer, metadata.name);
    res.json({
      name: metadata.name,
      path: metadata.path,
      sha: metadata.sha,
      size: metadata.size,
      htmlUrl: metadata.html_url,
      downloadUrl: metadata.download_url,
      isBinary: binary,
      mimeType: mimeFromFilename(metadata.name),
      content: binary ? null : buffer.toString('utf8'),
      base64: binary ? buffer.toString('base64') : null,
      tooLarge: false
    });
  } catch (error) {
    next(error);
  }
});

app.put('/api/repos/:owner/:repo/file', requireAuth, async (req, res, next) => {
  try {
    const { owner, repo } = validateOwnerRepo(req.params.owner, req.params.repo);
    const filePath = normalizePath(req.body?.path, { allowEmpty: false });
    const message = String(req.body?.message || '').trim();
    const branch = String(req.body?.branch || '').trim();
    const sha = String(req.body?.sha || '').trim();
    const contentEncoding = req.body?.contentEncoding === 'base64' ? 'base64' : 'utf8';
    const rawContent = String(req.body?.content ?? '');
    if (!message) throw httpError(400, 'Informe a mensagem do commit.');

    let buffer;
    try {
      buffer = contentEncoding === 'base64' ? Buffer.from(rawContent, 'base64') : Buffer.from(rawContent, 'utf8');
    } catch {
      throw httpError(400, 'Conteúdo inválido.');
    }
    if (buffer.length > MAX_WRITE_BYTES) {
      throw httpError(413, `O arquivo ultrapassa o limite de ${Math.floor(MAX_WRITE_BYTES / 1024 / 1024)} MB desta aplicação.`);
    }

    const body = { message, content: buffer.toString('base64') };
    if (branch) body.branch = branch;
    if (sha) body.sha = sha;

    const data = await githubJson(
      req.githubToken,
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodeRepoPath(filePath)}`,
      { method: 'PUT', body }
    );
    res.json({
      content: data.content ? { path: data.content.path, sha: data.content.sha, htmlUrl: data.content.html_url } : null,
      commit: data.commit ? { sha: data.commit.sha, htmlUrl: data.commit.html_url, message: data.commit.message } : null
    });
  } catch (error) {
    next(error);
  }
});

app.delete('/api/repos/:owner/:repo/file', requireAuth, async (req, res, next) => {
  try {
    const { owner, repo } = validateOwnerRepo(req.params.owner, req.params.repo);
    const filePath = normalizePath(req.body?.path, { allowEmpty: false });
    const message = String(req.body?.message || '').trim();
    const sha = String(req.body?.sha || '').trim();
    const branch = String(req.body?.branch || '').trim();
    if (!message) throw httpError(400, 'Informe a mensagem do commit.');
    if (!sha) throw httpError(400, 'SHA do arquivo ausente. Atualize o arquivo e tente novamente.');
    const body = { message, sha };
    if (branch) body.branch = branch;

    const data = await githubJson(
      req.githubToken,
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodeRepoPath(filePath)}`,
      { method: 'DELETE', body }
    );
    res.json({ commit: data.commit ? { sha: data.commit.sha, htmlUrl: data.commit.html_url, message: data.commit.message } : null });
  } catch (error) {
    next(error);
  }
});

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Rota não encontrada.', code: 'NOT_FOUND' });
});

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  const status = Number(error.status || 500);
  if (status >= 500 || process.env.NODE_ENV === 'development') console.error(error);
  let message = error.message || 'Erro interno do servidor.';
  if (error.name === 'TimeoutError') message = 'A solicitação demorou demais. Tente novamente.';
  if (status === 401) message = 'Sua autenticação expirou ou não tem acesso a este recurso.';
  if (status === 403 && error.rateRemaining === '0') {
    const reset = error.rateReset ? new Date(Number(error.rateReset) * 1000).toISOString() : null;
    message = `Limite da API do GitHub atingido.${reset ? ` Tente novamente após ${reset}.` : ''}`;
  }
  res.status(status).json({
    error: message,
    code: error.code || (status >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR'),
    details: error.publicDetails || (process.env.NODE_ENV === 'development' ? error.details : undefined)
  });
});

export default app;
