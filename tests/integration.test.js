import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

const requests = [];
let createdRepoId = 9001;
let createdBlobId = 0;
let emptyRepoHead = '';
let emptyRepoTree = '';
let portfolioHead = 'portfolio-head-0';
let portfolioTree = 'portfolio-tree-0';
let portfolioCommitCounter = 0;
let portfolioBlobCounter = 0;
let pendingPortfolioTree = [];
const portfolioFiles = new Map();
const portfolioBlobs = new Map();
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

  if (url.pathname.startsWith('/repos/tester/portfolio/')) {
    const prefix = '/repos/tester/portfolio';
    if (req.method === 'GET' && url.pathname === `${prefix}/git/ref/heads/main`) {
      return json(200, { ref: 'refs/heads/main', object: { sha: portfolioHead } });
    }
    if (req.method === 'GET' && url.pathname === `${prefix}/git/commits/${portfolioHead}`) {
      return json(200, { sha: portfolioHead, tree: { sha: portfolioTree } });
    }
    if (req.method === 'GET' && url.pathname === `${prefix}/contents/public/projetos`) {
      const ids = [...new Set(
        [...portfolioFiles.keys()]
          .filter((filePath) => filePath.startsWith('public/projetos/'))
          .map((filePath) => filePath.split('/')[2])
          .filter(Boolean)
      )];
      if (!ids.length) return json(404, { message: 'Not Found' });
      return json(200, ids.map((id) => ({ type: 'dir', name: id, path: `public/projetos/${id}` })));
    }
    if (req.method === 'GET' && url.pathname.startsWith(`${prefix}/contents/`)) {
      const filePath = decodeURIComponent(url.pathname.slice(`${prefix}/contents/`.length));
      if (!portfolioFiles.has(filePath)) return json(404, { message: 'Not Found' });
      return json(200, {
        type: 'file',
        path: filePath,
        content: Buffer.from(portfolioFiles.get(filePath), 'utf8').toString('base64'),
        encoding: 'base64'
      });
    }
    if (req.method === 'POST' && url.pathname === `${prefix}/git/blobs`) {
      portfolioBlobCounter += 1;
      const sha = `portfolio-blob-${portfolioBlobCounter}`;
      const content = body.encoding === 'base64'
        ? Buffer.from(body.content, 'base64').toString('utf8')
        : String(body.content || '');
      portfolioBlobs.set(sha, content);
      return json(201, { sha });
    }
    if (req.method === 'POST' && url.pathname === `${prefix}/git/trees`) {
      pendingPortfolioTree = body.tree;
      portfolioTree = `portfolio-tree-${portfolioCommitCounter + 1}`;
      return json(201, { sha: portfolioTree });
    }
    if (req.method === 'POST' && url.pathname === `${prefix}/git/commits`) {
      portfolioCommitCounter += 1;
      return json(201, {
        sha: `portfolio-commit-${portfolioCommitCounter}`,
        html_url: `https://github.com/tester/portfolio/commit/portfolio-commit-${portfolioCommitCounter}`,
        message: body.message
      });
    }
    if (req.method === 'PATCH' && url.pathname === `${prefix}/git/refs/heads/main`) {
      for (const entry of pendingPortfolioTree) {
        if (entry.sha === null) portfolioFiles.delete(entry.path);
        else portfolioFiles.set(entry.path, portfolioBlobs.get(entry.sha) || '');
      }
      portfolioHead = body.sha;
      pendingPortfolioTree = [];
      return json(200, { ref: 'refs/heads/main', object: { sha: body.sha } });
    }
  }

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
  if (req.method === 'GET' && url.pathname === '/repos/tester/empty') {
    return json(200, {
      id: 777, name: 'empty', full_name: 'tester/empty', owner: { login: 'tester' },
      private: true, archived: false, default_branch: 'main', description: null,
      language: null, updated_at: new Date().toISOString(), permissions: { push: true },
      html_url: 'https://github.com/tester/empty'
    });
  }
  if (req.method === 'GET' && url.pathname === '/repos/tester/empty/branches') {
    return json(200, emptyRepoHead ? [{ name: 'main', protected: false, commit: { sha: emptyRepoHead } }] : []);
  }
  if (req.method === 'GET' && url.pathname === '/repos/tester/empty/git/ref/heads/main') {
    if (!emptyRepoHead) return json(404, { message: 'Not Found' });
    return json(200, { ref: 'refs/heads/main', object: { sha: emptyRepoHead } });
  }
  if (req.method === 'PUT' && url.pathname === '/repos/tester/empty/contents/.github-file-manager-init') {
    emptyRepoHead = 'empty-init-commit';
    emptyRepoTree = 'empty-init-tree';
    return json(201, {
      content: { path: '.github-file-manager-init', sha: 'empty-placeholder-blob' },
      commit: { sha: emptyRepoHead, html_url: 'https://github.com/tester/empty/commit/empty-init-commit', message: body.message }
    });
  }
  if (req.method === 'GET' && url.pathname === `/repos/tester/empty/git/commits/${emptyRepoHead}`) {
    return json(200, { sha: emptyRepoHead, tree: { sha: emptyRepoTree } });
  }
  if (req.method === 'GET' && url.pathname === '/repos/tester/empty/git/trees/empty-init-tree' && url.searchParams.get('recursive') === '1') {
    return json(200, { truncated: false, tree: [
      { path: '.github-file-manager-init', type: 'blob', sha: 'empty-placeholder-blob', size: 35 }
    ] });
  }
  if (req.method === 'POST' && url.pathname === '/repos/tester/empty/git/blobs') {
    createdBlobId += 1;
    return json(201, { sha: String(createdBlobId).padStart(40, 'b') });
  }
  if (req.method === 'POST' && url.pathname === '/repos/tester/empty/git/trees') {
    return json(201, { sha: 'empty-upload-tree' });
  }
  if (req.method === 'POST' && url.pathname === '/repos/tester/empty/git/commits') {
    return json(201, { sha: 'empty-upload-commit', html_url: 'https://github.com/tester/empty/commit/empty-upload-commit', message: body.message });
  }
  if (req.method === 'PATCH' && url.pathname === '/repos/tester/empty/git/refs/heads/main') {
    emptyRepoHead = body.sha;
    emptyRepoTree = 'empty-upload-tree';
    return json(200, { ref: 'refs/heads/main', object: { sha: body.sha } });
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
  if (req.method === 'POST' && url.pathname === '/repos/tester/demo/git/blobs') {
    createdBlobId += 1;
    return json(201, { sha: String(createdBlobId).padStart(40, 'a') });
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
process.env.GITHUB_TOKEN = 'github-token-for-portfolio-tests';
process.env.GITHUB_OWNER = 'tester';
process.env.GITHUB_REPO = 'portfolio';
process.env.GITHUB_BRANCH = 'main';
process.env.ADMIN_PASSWORD = 'admin-test-password';

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

  result = await request('/api/repos/tester/demo/upload/blob', {
    method: 'POST', body: { content: Buffer.from('console.log(1);').toString('base64') }
  });
  assert.equal(result.response.status, 201);
  const firstBlobSha = result.data.sha;

  result = await request('/api/repos/tester/demo/upload/blob', {
    method: 'POST', body: { content: Buffer.from('imagem').toString('base64') }
  });
  assert.equal(result.response.status, 201);
  const secondBlobSha = result.data.sha;

  result = await request('/api/repos/tester/demo/upload/commit', {
    method: 'POST',
    body: {
      branch: 'feature/demo', message: 'Conflito', overwrite: false, baseHeadSha: 'head-feature',
      files: [{ path: 'src/app.js', sha: firstBlobSha }]
    }
  });
  assert.equal(result.response.status, 409);
  assert.equal(result.data.code, 'UPLOAD_CONFLICT');
  assert.deepEqual(result.data.details.conflicts, ['src/app.js']);

  result = await request('/api/repos/tester/demo/upload/commit', {
    method: 'POST',
    body: {
      branch: 'feature/demo', message: 'Adiciona projeto', overwrite: false, baseHeadSha: 'head-feature',
      files: [
        { path: 'src/new.js', sha: firstBlobSha },
        { path: 'assets/logo.txt', sha: secondBlobSha }
      ]
    }
  });
  assert.equal(result.response.status, 201);
  assert.equal(result.data.uploaded, 2);
  const uploadTreeRequest = requests.filter((entry) => entry.method === 'POST' && entry.path === '/repos/tester/demo/git/trees').at(-1);
  assert.deepEqual(uploadTreeRequest.body.tree, [
    { path: 'src/new.js', mode: '100644', type: 'blob', sha: firstBlobSha },
    { path: 'assets/logo.txt', mode: '100644', type: 'blob', sha: secondBlobSha }
  ]);

  result = await request('/api/repos/tester/demo/pulls', {
    method: 'POST', body: { title: 'Nova mudança', body: 'Descrição', head: 'feature/demo', base: 'main', draft: false }
  });
  assert.equal(result.response.status, 201);
  assert.equal(result.data.number, 12);
});

test('inicializa repositório vazio e confirma todos os arquivos selecionados juntos', async () => {
  let result = await request('/api/repos/tester/empty/file-index?ref=main');
  assert.equal(result.response.status, 200);
  assert.equal(result.data.empty, true);
  assert.equal(result.data.headSha, '');
  assert.deepEqual(result.data.items, []);

  result = await request('/api/repos/tester/empty/upload/blob', {
    method: 'POST', body: { content: Buffer.from('<h1>Olá</h1>').toString('base64') }
  });
  assert.equal(result.response.status, 201);
  const htmlSha = result.data.sha;

  result = await request('/api/repos/tester/empty/upload/blob', {
    method: 'POST', body: { content: Buffer.from('body {}').toString('base64') }
  });
  assert.equal(result.response.status, 201);
  const cssSha = result.data.sha;

  result = await request('/api/repos/tester/empty/upload/commit', {
    method: 'POST',
    body: {
      branch: 'main', message: 'Adiciona projeto inicial', overwrite: false,
      baseHeadSha: '', baseWasEmpty: true,
      files: [
        { path: 'index.html', sha: htmlSha },
        { path: 'css/style.css', sha: cssSha }
      ]
    }
  });
  assert.equal(result.response.status, 201);
  assert.equal(result.data.initialized, true);
  assert.equal(result.data.uploaded, 2);
  assert.equal(result.data.commit.sha, 'empty-upload-commit');

  const initRequest = requests.find((entry) => entry.method === 'PUT' && entry.path === '/repos/tester/empty/contents/.github-file-manager-init');
  assert.ok(initRequest);
  const finalTree = requests.filter((entry) => entry.method === 'POST' && entry.path === '/repos/tester/empty/git/trees').at(-1);
  assert.deepEqual(finalTree.body.tree, [
    { path: 'index.html', mode: '100644', type: 'blob', sha: htmlSha },
    { path: 'css/style.css', mode: '100644', type: 'blob', sha: cssSha },
    { path: '.github-file-manager-init', mode: '100644', type: 'blob', sha: null }
  ]);
});



test('publica e atualiza somente a pasta individual do projeto', async () => {
  const headers = { 'x-admin-password': 'admin-test-password' };
  let result = await request('/api/github-project', {
    method: 'POST',
    headers,
    body: {
      project: {
        id: 'calculadora-pessoal',
        title: 'Calculadora pessoal',
        description: 'Projeto isolado para teste.',
        category: 'Ferramentas',
        technologies: ['HTML', 'JavaScript'],
        status: 'online',
        featured: true,
        language: 'html'
      },
      code: '<!doctype html><html><body><h1>Versão 1</h1></body></html>'
    }
  });

  assert.equal(result.response.status, 200);
  assert.deepEqual(result.data.changedFiles, [
    'public/projetos/calculadora-pessoal/index.html',
    'public/projetos/calculadora-pessoal/source.txt',
    'public/projetos/calculadora-pessoal/project.json'
  ]);

  const firstTree = requests
    .filter((entry) => entry.method === 'POST' && entry.path === '/repos/tester/portfolio/git/trees')
    .at(-1);
  assert.deepEqual(firstTree.body.tree.map((entry) => entry.path), result.data.changedFiles);
  assert.ok(firstTree.body.tree.every((entry) => entry.path.startsWith('public/projetos/calculadora-pessoal/')));
  assert.equal(firstTree.body.tree.some((entry) => entry.path === 'public/projects.json'), false);
  assert.equal(firstTree.body.tree.some((entry) => entry.path.startsWith('public/gerenciahub/')), false);
  assert.equal(firstTree.body.tree.some((entry) => entry.path.startsWith('public/visualizador/')), false);
  assert.equal(firstTree.body.tree.some((entry) => entry.path.startsWith('public/portfolio/')), false);

  result = await request('/api/portfolio-projects');
  assert.equal(result.response.status, 200);
  assert.equal(result.data.length, 1);
  assert.equal(result.data[0].id, 'calculadora-pessoal');
  assert.equal(result.data[0].folder, 'public/projetos/calculadora-pessoal');
  assert.equal(result.data[0].source, '/projetos/calculadora-pessoal/source.txt');

  result = await request('/api/github-project', {
    method: 'PUT',
    headers,
    body: {
      originalId: 'calculadora-pessoal',
      project: {
        ...result.data[0],
        title: 'Calculadora pessoal atualizada',
        language: 'html'
      },
      code: '<!doctype html><html><body><h1>Versão 2</h1></body></html>'
    }
  });

  assert.equal(result.response.status, 200);
  const updateTree = requests
    .filter((entry) => entry.method === 'POST' && entry.path === '/repos/tester/portfolio/git/trees')
    .at(-1);
  assert.deepEqual(updateTree.body.tree.map((entry) => entry.path), [
    'public/projetos/calculadora-pessoal/index.html',
    'public/projetos/calculadora-pessoal/source.txt',
    'public/projetos/calculadora-pessoal/project.json'
  ]);
  assert.ok(updateTree.body.tree.every((entry) => entry.path.startsWith('public/projetos/calculadora-pessoal/')));
});
