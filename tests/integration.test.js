import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

const requests = [];
let createdRepoId = 9001;
const mockServer = http.createServer(async (req, res) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  const body = raw ? JSON.parse(raw) : null;
  const url = new URL(req.url, 'http://mock.local');
  requests.push({ method: req.method, path: url.pathname, search: url.search, body });

  const json = (status, value, headers = {}) => {
    res.writeHead(status, { 'content-type': 'application/json', ...headers });
    res.end(JSON.stringify(value));
  };

  if (req.method === 'GET' && url.pathname === '/user') {
    return json(200, { login: 'tester', name: 'Test User', avatar_url: 'https://example.test/a.png', html_url: 'https://github.com/tester' });
  }
  if (req.method === 'POST' && url.pathname === '/user/repos') {
    return json(201, {
      id: createdRepoId++, name: body.name, full_name: `tester/${body.name}`, owner: { login: 'tester' },
      private: body.private, archived: false, default_branch: 'main', description: body.description || null,
      language: null, updated_at: new Date().toISOString(), permissions: { push: true }, html_url: `https://github.com/tester/${body.name}`
    });
  }
  if (req.method === 'GET' && url.pathname === '/repos/tester/demo/branches') {
    return json(200, [{ name: 'main', protected: false, commit: { sha: 'head-main' } }, { name: 'feature/demo', protected: false, commit: { sha: 'head-feature' } }]);
  }
  if (req.method === 'GET' && url.pathname === '/repos/tester/demo/git/ref/heads/main') {
    return json(200, { ref: 'refs/heads/main', object: { sha: 'head-main' } });
  }
  if (req.method === 'GET' && url.pathname === '/repos/tester/demo/git/ref/heads/feature/demo') {
    return json(200, { ref: 'refs/heads/feature/demo', object: { sha: 'head-feature' } });
  }
  if (req.method === 'POST' && url.pathname === '/repos/tester/demo/git/refs') {
    return json(201, { ref: body.ref, object: { sha: body.sha } });
  }
  if (req.method === 'POST' && url.pathname === '/repos/tester/demo/pulls') {
    return json(201, {
      number: 12, title: body.title, state: 'open', draft: body.draft, html_url: 'https://github.com/tester/demo/pull/12',
      head: { ref: body.head }, base: { ref: body.base }
    });
  }
  if (req.method === 'GET' && url.pathname === '/repos/tester/demo/git/commits/head-feature') {
    return json(200, { sha: 'head-feature', tree: { sha: 'tree-feature' } });
  }
  if (req.method === 'GET' && url.pathname === '/repos/tester/demo/git/trees/tree-feature' && url.searchParams.get('recursive') === '1') {
    return json(200, { truncated: false, tree: [
      { path: 'src', type: 'tree', sha: 'tree-src' },
      { path: 'src/app.js', type: 'blob', sha: 'blob-app', size: 120 }
    ] });
  }
  if (req.method === 'GET' && url.pathname === '/repos/tester/demo/contents/src/app.js' && url.searchParams.get('ref') === 'head-feature') {
    return json(200, { type: 'file', path: 'src/app.js', name: 'app.js', sha: 'blob-app', size: 120 });
  }
  if (req.method === 'GET' && url.pathname === '/repos/tester/demo/contents/src/app-renamed.js' && url.searchParams.get('ref') === 'head-feature') {
    return json(404, { message: 'Not Found' });
  }
  if (req.method === 'POST' && url.pathname === '/repos/tester/demo/git/trees') {
    return json(201, { sha: 'tree-new' });
  }
  if (req.method === 'POST' && url.pathname === '/repos/tester/demo/git/commits') {
    return json(201, { sha: 'commit-new', html_url: 'https://github.com/tester/demo/commit/commit-new', message: body.message });
  }
  if (req.method === 'PATCH' && url.pathname === '/repos/tester/demo/git/refs/heads/feature/demo') {
    return json(200, { ref: 'refs/heads/feature/demo', object: { sha: body.sha } });
  }

  return json(404, { message: `Unhandled ${req.method} ${url.pathname}${url.search}` });
});

await new Promise((resolve) => mockServer.listen(0, '127.0.0.1', resolve));
const mockAddress = mockServer.address();
process.env.GITHUB_API_URL = `http://127.0.0.1:${mockAddress.port}`;
process.env.SESSION_SECRET = 'test-session-secret-with-more-than-24-characters';
process.env.NODE_ENV = 'test';

const { default: app } = await import('../app.js');
const appServer = app.listen(0, '127.0.0.1');
await new Promise((resolve) => appServer.once('listening', resolve));
const address = appServer.address();
const base = `http://127.0.0.1:${address.port}`;
let cookie = '';

async function request(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (cookie) headers.cookie = cookie;
  if (options.body && typeof options.body !== 'string') {
    headers['content-type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }
  const response = await fetch(`${base}${path}`, { ...options, headers });
  const setCookie = response.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];
  const data = await response.json();
  return { response, data };
}

test.after(() => {
  appServer.close();
  mockServer.close();
});

test('autentica, cria repositório, branch, índice, operação e pull request', async () => {
  let result = await request('/api/auth/token', { method: 'POST', body: { token: 'ghp_123456789012345678901234567890123456', remember: false } });
  assert.equal(result.response.status, 200);
  assert.equal(result.data.user.login, 'tester');
  assert.ok(cookie.startsWith('ghfm_session='));

  result = await request('/api/repos', { method: 'POST', body: { name: 'novo-repo', description: 'Teste', visibility: 'private', autoInit: true } });
  assert.equal(result.response.status, 201);
  assert.equal(result.data.fullName, 'tester/novo-repo');

  result = await request('/api/repos/tester/demo/branches', { method: 'POST', body: { name: 'feature/nova', sourceBranch: 'main' } });
  assert.equal(result.response.status, 201);
  assert.equal(result.data.name, 'feature/nova');

  result = await request('/api/repos/tester/demo/file-index?ref=feature%2Fdemo');
  assert.equal(result.response.status, 200);
  assert.equal(result.data.items[1].path, 'src/app.js');

  result = await request('/api/repos/tester/demo/file-operation', {
    method: 'POST',
    body: {
      operation: 'move', sourcePath: 'src/app.js', destinationPath: 'src/app-renamed.js',
      branch: 'feature/demo', message: 'Renomeia app', sha: 'blob-app'
    }
  });
  assert.equal(result.response.status, 200);
  assert.equal(result.data.commit.sha, 'commit-new');
  const treeRequest = requests.find((entry) => entry.method === 'POST' && entry.path === '/repos/tester/demo/git/trees');
  assert.deepEqual(treeRequest.body.tree, [
    { path: 'src/app-renamed.js', mode: '100644', type: 'blob', sha: 'blob-app' },
    { path: 'src/app.js', mode: '100644', type: 'blob', sha: null }
  ]);

  result = await request('/api/repos/tester/demo/pulls', {
    method: 'POST', body: { title: 'Nova mudança', body: 'Descrição', head: 'feature/demo', base: 'main', draft: false }
  });
  assert.equal(result.response.status, 201);
  assert.equal(result.data.number, 12);
});
