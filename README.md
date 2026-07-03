# GitHub File Manager 2.0

Aplicativo web responsivo para administrar repositórios e arquivos do GitHub diretamente no navegador. O frontend usa HTML, CSS e JavaScript puro; o backend usa Node.js com Express e funciona localmente ou como uma única Function na Vercel.

## Novidades da versão 2.0

- Criação de repositórios públicos ou privados.
- Criação de branches a partir da branch selecionada.
- Abertura de Pull Requests, inclusive como rascunho.
- Renomear, mover e copiar arquivos.
- Mover e renomear em um único commit pela Git Data API.
- Pesquisa rápida de arquivos e pastas na branch atual.
- Atalho `Ctrl + P` ou `Cmd + P` para abrir a pesquisa.
- Links diretos para commits, repositórios e Pull Requests criados.

## Recursos existentes

- Login com OAuth do GitHub ou Personal Access Token.
- Token guardado em cookie HTTP-only criptografado.
- Listagem de repositórios públicos e privados autorizados.
- Navegação por diretórios e seleção de branch.
- Visualizador/editor com linhas e destaque de sintaxe.
- Rascunhos locais e cache de repositórios, diretórios e índice de busca.
- Prévia de imagens e identificação de arquivos binários.
- Criação, upload, edição e exclusão por commits.
- Interface responsiva para computador, tablet e celular.
- Tratamento de sessão expirada, conflito de SHA, rate limit e falhas de rede.

## Permissões necessárias

### OAuth App

O escopo padrão é:

```text
repo read:user
```

O escopo `repo` permite trabalhar com repositórios privados, arquivos, branches, Pull Requests e criação de repositórios na conta autorizada.

### Personal Access Token fine-grained

Selecione os repositórios que serão administrados e conceda, conforme os recursos usados:

- **Contents: Read and write** — arquivos, commits, branches, pesquisa e operações de mover/copiar.
- **Pull requests: Read and write** — criação de Pull Requests.
- **Administration: Read and write** — criação de novos repositórios.
- Permissão de workflows, quando for necessário alterar arquivos em `.github/workflows`.

Se o token não tiver uma permissão, apenas a função correspondente falhará com a mensagem retornada pelo GitHub.

## Executar localmente

Requisitos:

- Node.js 20 ou superior.
- npm.

No Windows PowerShell:

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

No macOS ou Linux:

```bash
npm install
cp .env.example .env
npm run dev
```

Abra:

```text
http://localhost:3000
```

O arquivo `.env` é carregado pelo `server.js` em desenvolvimento sem dependência adicional.

### Caso o npm apresente `ETIMEDOUT`

O projeto inclui `.npmrc` apontando para o registro público. Em uma pasta que veio de uma versão antiga, execute:

```powershell
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
Remove-Item -Force package-lock.json -ErrorAction SilentlyContinue
npm install --registry=https://registry.npmjs.org/
npm run dev
```

## Configurar login por token

Para usar somente Personal Access Token, configure ao menos:

```env
SESSION_SECRET=uma-chave-longa-com-mais-de-32-caracteres
```

A credencial digitada no navegador é validada pelo backend, criptografada com AES-256-GCM e mantida em cookie HTTP-only. Ela não é salva no `localStorage`.

## Configurar OAuth do GitHub

Na OAuth App do GitHub, use em desenvolvimento:

```text
Homepage URL:
http://localhost:3000

Authorization callback URL:
http://localhost:3000/api/auth/callback
```

Configure o `.env`:

```env
SESSION_SECRET=uma-chave-longa-com-mais-de-32-caracteres
GITHUB_CLIENT_ID=seu_client_id
GITHUB_CLIENT_SECRET=seu_client_secret
APP_URL=http://localhost:3000
GITHUB_OAUTH_SCOPE=repo read:user
```

Em produção, troque a Homepage URL, a callback e `APP_URL` pela URL final da Vercel.

## Implantar no Vercel

1. Envie todos os arquivos para um repositório do GitHub.
2. Na Vercel, escolha **Add New → Project**.
3. Importe o repositório.
4. Mantenha o framework como **Other** ou sem preset.
5. Adicione as variáveis de ambiente.
6. Faça o deploy.

Variáveis recomendadas para produção:

```env
SESSION_SECRET=chave-aleatoria-com-pelo-menos-32-caracteres
APP_URL=https://seu-projeto.vercel.app
GITHUB_CLIENT_ID=seu_client_id
GITHUB_CLIENT_SECRET=seu_client_secret
GITHUB_OAUTH_SCOPE=repo read:user
```

Depois de criar ou alterar variáveis na Vercel, faça um **Redeploy**. O arquivo `vercel.json` faz a raiz `/` abrir `public/index.html` e mantém `/api/*` no Express.

## Como usar as novas funções

### Criar repositório

1. Clique no botão `＋` ao lado do título **Repositórios**.
2. Informe nome, descrição e visibilidade.
3. Mantenha **Inicializar com README** marcado para criar a branch principal.
4. Clique em **Criar repositório**.

### Criar branch

1. Abra um repositório.
2. Selecione a branch que servirá de origem.
3. Clique em **＋ Branch**.
4. Informe o nome, por exemplo `feature/tela-login`.
5. A nova branch será criada e selecionada automaticamente.

### Abrir Pull Request

1. Confirme suas alterações na branch de trabalho.
2. Clique em **Pull Request**.
3. Escolha a branch de origem e a de destino.
4. Informe título e descrição.
5. Opcionalmente marque **Criar como rascunho**.

### Renomear, mover ou copiar

1. Abra um arquivo.
2. Clique em **Mover/copiar**.
3. Escolha a operação.
4. Informe o novo caminho completo.
5. Informe a mensagem do commit.

Renomear e mover usam a Git Data API para criar e remover os caminhos no mesmo commit. A aplicação impede sobrescrever um destino existente e verifica o SHA do arquivo antes da operação.

### Pesquisa rápida

1. Clique em **⌕ Buscar** ou pressione `Ctrl + P`.
2. Pesquise pelo nome ou por qualquer parte do caminho.
3. Use as setas para navegar e `Enter` para abrir.

O índice corresponde à branch selecionada. Em repositórios muito grandes, a API do GitHub pode informar que a árvore foi truncada; a interface sinaliza quando o resultado é parcial.

## Scripts

```bash
npm run dev     # desenvolvimento com reinício automático
npm start       # servidor local sem watch
npm run check   # valida sintaxe dos arquivos JavaScript
npm test        # testes de integração com API GitHub simulada
```

## Variáveis de ambiente

| Variável | Obrigatória | Descrição |
|---|---:|---|
| `SESSION_SECRET` | Produção | Criptografa o cookie. Use pelo menos 32 caracteres aleatórios. |
| `GITHUB_CLIENT_ID` | OAuth | Client ID da OAuth App. |
| `GITHUB_CLIENT_SECRET` | OAuth | Client Secret da OAuth App. |
| `APP_URL` | OAuth/produção | URL pública sem barra final. |
| `GITHUB_OAUTH_SCOPE` | Não | Padrão: `repo read:user`. |
| `GITHUB_API_VERSION` | Não | Padrão: `2026-03-10`. |
| `GITHUB_API_URL` | Não | Padrão: `https://api.github.com`; também permite API compatível em testes. |
| `PORT` | Não | Porta local; padrão `3000`. |

## Limites e comportamento

- Upload e gravação: até 3 MB por arquivo nesta aplicação.
- Leitura no editor: até 5 MB; arquivos maiores ficam disponíveis para download externo.
- Diretórios vazios não existem no Git; use `.gitkeep` quando necessário.
- A cópia e movimentação desta versão são destinadas a arquivos, não a pastas completas.
- O destino de uma operação não é sobrescrito automaticamente.
- Se a branch mudar no GitHub durante uma operação, a atualização da referência falha sem `force`, evitando apagar alterações concorrentes.
- O índice de pesquisa usa a árvore recursiva da branch e pode ser parcial em repositórios muito grandes.

## Estrutura

```text
.
├── public/
│   ├── index.html
│   ├── styles.css
│   ├── app.js
│   └── favicon.svg
├── tests/
│   └── integration.test.js
├── app.js
├── server.js
├── vercel.json
├── .env.example
├── .npmrc
└── package.json
```

## Segurança

- Token ausente do HTML e do `localStorage`.
- Cookie HTTP-only, SameSite=Lax e Secure em HTTPS.
- Sessão criptografada com AES-256-GCM.
- OAuth protegido por `state` e PKCE.
- Client Secret usado somente no backend.
- Normalização de caminhos e nomes de branch.
- Atualizações de referência sem `force`.
- Respostas de API marcadas com `Cache-Control: no-store`.
