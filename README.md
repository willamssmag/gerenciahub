# GitHub File Manager

Aplicativo web responsivo para navegar, visualizar, editar, criar, enviar e excluir arquivos em repositórios do GitHub.

## Recursos

- Login com OAuth do GitHub ou Personal Access Token.
- Token guardado em cookie HTTP-only criptografado.
- Lista de repositórios públicos e privados autorizados.
- Navegação por diretórios e seleção de branch.
- Visualizador/editor de texto com linhas e destaque de sintaxe.
- Prévia de imagens e identificação de arquivos binários.
- Criação, upload, edição e exclusão por meio de commits.
- Cache local de repositórios, diretórios e rascunhos.
- Interface adaptável para desktop, tablet e celular.
- Backend Express compatível com execução local e Vercel.

## Requisitos

- Node.js 20 ou superior.
- Uma conta no GitHub.
- Para login por token: um PAT fine-grained com acesso aos repositórios desejados e permissão **Contents: Read and write**.

## Executar localmente

```bash
npm install
cp .env.example .env       # macOS/Linux
# Copy-Item .env.example .env  # Windows PowerShell
npm run dev
```

Acesse `http://localhost:3000`.

O servidor carrega o arquivo `.env` automaticamente em desenvolvimento, sem biblioteca adicional.

### Se o `npm install` falhar com `ETIMEDOUT`

Este pacote fixa o registro público oficial do npm no arquivo `.npmrc`. Em uma extração antiga do projeto, remova as dependências e o arquivo de trava antes de instalar novamente:

```powershell
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
Remove-Item package-lock.json -Force -ErrorAction SilentlyContinue
npm install --registry=https://registry.npmjs.org/
npm run dev
```

## Login por token

O OAuth é opcional. Para usar somente um token, configure ao menos:

```env
SESSION_SECRET=uma-chave-longa-com-mais-de-32-caracteres
```

Crie um token fine-grained no GitHub e conceda:

- Acesso aos repositórios necessários.
- Repository permissions → **Contents: Read and write**.
- Para alterar arquivos em `.github/workflows`, conceda também a permissão apropriada para workflows.

## Configurar OAuth do GitHub

1. No GitHub, abra **Settings → Developer settings → OAuth Apps → New OAuth App**.
2. Use `http://localhost:3000` como Homepage URL para desenvolvimento.
3. Use `http://localhost:3000/api/auth/callback` como Authorization callback URL.
4. Copie o Client ID e gere um Client Secret.
5. Configure:

```env
SESSION_SECRET=uma-chave-longa-com-mais-de-32-caracteres
GITHUB_CLIENT_ID=seu_client_id
GITHUB_CLIENT_SECRET=seu_client_secret
APP_URL=http://localhost:3000
GITHUB_OAUTH_SCOPE=repo read:user
```

Em produção, troque `APP_URL` e a callback da OAuth App pela URL do Vercel, por exemplo:

```text
https://seu-projeto.vercel.app/api/auth/callback
```

## Implantar no Vercel

### Pelo painel

1. Envie este projeto para um repositório do GitHub.
2. No Vercel, escolha **Add New → Project** e importe o repositório.
3. Não defina framework.
4. Adicione as variáveis de ambiente:
   - `SESSION_SECRET`
   - `APP_URL`
   - `GITHUB_CLIENT_ID` e `GITHUB_CLIENT_SECRET` se usar OAuth
   - `GITHUB_OAUTH_SCOPE` opcional
5. Faça o deploy.

### Pela CLI

```bash
npm install -g vercel
vercel
vercel env add SESSION_SECRET
vercel env add APP_URL
vercel --prod
```

A Vercel detecta o `app.js` exportado, transforma o Express em uma única Vercel Function e serve os arquivos de `public/` pelo CDN.

## Variáveis de ambiente

| Variável | Obrigatória | Descrição |
|---|---:|---|
| `SESSION_SECRET` | Produção | Criptografa o cookie da sessão. Use ao menos 32 caracteres aleatórios. |
| `GITHUB_CLIENT_ID` | OAuth | Client ID da OAuth App. |
| `GITHUB_CLIENT_SECRET` | OAuth | Client Secret da OAuth App. |
| `APP_URL` | OAuth/produção | URL base pública, sem barra final. |
| `GITHUB_OAUTH_SCOPE` | Não | Padrão: `repo read:user`. |
| `GITHUB_API_VERSION` | Não | Padrão: `2026-03-10`. |
| `GITHUB_API_URL` | Não | Padrão: `https://api.github.com`; útil para GitHub Enterprise. |
| `PORT` | Não | Padrão local: `3000`. |

## Limites e observações

- Uploads e gravações foram limitados a 3 MB para permanecerem compatíveis com o limite de corpo das funções serverless e com a expansão do Base64.
- Leitura no editor foi limitada a 5 MB. Arquivos maiores são oferecidos para download/abertura externa.
- A API de Contents cria um commit por arquivo. Uploads múltiplos em um único commit exigiriam a Git Data API e não fazem parte desta versão.
- Diretórios vazios não existem no Git; crie um arquivo como `.gitkeep` para mantê-los.
- Operações concorrentes no mesmo arquivo podem resultar em conflito de SHA. A interface solicita a reabertura do arquivo nesse caso.

## Estrutura

```text
.
├── public/
│   ├── index.html
│   ├── styles.css
│   ├── app.js
│   └── favicon.svg
├── app.js             # Express; vira uma Vercel Function em produção
├── server.js          # Servidor local
├── .env.example
└── package.json
```

## Segurança

- O token não é salvo em `localStorage`.
- A sessão é criptografada com AES-256-GCM e enviada em cookie HTTP-only, SameSite=Lax e Secure em HTTPS.
- O OAuth usa `state` e PKCE para proteção adicional.
- O Client Secret nunca é enviado ao navegador.
- Em produção, use HTTPS e uma `SESSION_SECRET` exclusiva e forte.
