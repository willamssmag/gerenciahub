# GitHub File Manager 2.1.1

Aplicativo web responsivo para administrar repositórios e arquivos do GitHub diretamente no navegador. O frontend usa HTML, CSS e JavaScript puro; o backend usa Node.js com Express e funciona localmente ou como uma única Function na Vercel.

## Correção da versão 2.1.1

- Upload múltiplo agora funciona também em repositórios totalmente vazios, sem README e sem primeiro commit.
- A aplicação detecta quando a branch ainda não existe, inicializa o repositório automaticamente e remove o arquivo temporário no commit final.
- Todos os arquivos selecionados continuam entrando juntos no commit final.
- Pesquisa, listagem de pastas e mensagens de erro passam a tratar repositórios vazios sem exibir apenas `Not Found`.
- Criação de branch em repositório vazio mostra uma instrução clara para realizar o primeiro upload.

## Novidades da versão 2.1

- Seleção de vários arquivos de uma vez.
- Seleção de pastas completas, preservando subpastas e nomes dos arquivos.
- Arrastar e soltar arquivos ou diretórios na janela de upload.
- Arrastar arquivos diretamente sobre o navegador de arquivos do projeto.
- Fila de upload com caminho, tamanho e remoção individual.
- Progresso por quantidade de arquivos enviados.
- Detecção de arquivos já existentes antes do commit.
- Opção explícita para substituir arquivos existentes.
- Todos os itens de uma operação são confirmados juntos no commit final. Em um repositório totalmente vazio, a aplicação cria antes um commit técnico de inicialização e o remove da árvore no commit do upload.
- Proteção contra alterações concorrentes na branch durante o upload.

O navegador envia cada arquivo separadamente para criação do blob Git e, ao final, a aplicação cria uma árvore e um único commit. Isso permite selecionar muitos itens sem colocar todos os dados em uma única requisição à Function da Vercel.

## Recursos da versão 2.0 mantidos

- Login por OAuth do GitHub ou Personal Access Token.
- Criação de repositórios públicos ou privados.
- Criação de branches a partir da branch selecionada.
- Abertura de Pull Requests, inclusive como rascunho.
- Renomear, mover e copiar arquivos.
- Pesquisa rápida de arquivos e pastas com `Ctrl + P` ou `Cmd + P`.
- Navegação por diretórios, visualização, edição e exclusão.
- Destaque de sintaxe, prévia de imagens, cache e rascunhos locais.
- Interface responsiva para computador, tablet e celular.

## Permissões necessárias

### OAuth App

O escopo padrão é:

```text
repo read:user
```

### Personal Access Token fine-grained

Conceda conforme as funções usadas:

- **Contents: Read and write** — upload múltiplo, arquivos, commits, branches, busca, mover e copiar.
- **Pull requests: Read and write** — criação de Pull Requests.
- **Administration: Read and write** — criação de novos repositórios.
- Permissão de workflows quando for necessário alterar `.github/workflows`.

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

### Caso o npm apresente `ETIMEDOUT`

```powershell
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
Remove-Item -Force package-lock.json -ErrorAction SilentlyContinue
"registry=https://registry.npmjs.org/" | Set-Content .npmrc
npm install --registry=https://registry.npmjs.org/
npm run dev
```

## Configurar login por token

Configure ao menos:

```env
SESSION_SECRET=uma-chave-longa-com-mais-de-32-caracteres
```

O token é validado pelo backend, criptografado com AES-256-GCM e guardado em cookie HTTP-only. Ele não é salvo no `localStorage`.

## Configurar OAuth do GitHub

Na OAuth App, use em desenvolvimento:

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

Em produção, troque as URLs por seu domínio da Vercel.

## Implantar no Vercel

1. Envie todos os arquivos para um repositório do GitHub.
2. Na Vercel, escolha **Add New → Project**.
3. Importe o repositório.
4. Mantenha o framework como **Other** ou sem preset.
5. Cadastre as variáveis de ambiente.
6. Faça o deploy.

Variáveis recomendadas:

```env
SESSION_SECRET=chave-aleatoria-com-pelo-menos-32-caracteres
APP_URL=https://seu-projeto.vercel.app
GITHUB_CLIENT_ID=seu_client_id
GITHUB_CLIENT_SECRET=seu_client_secret
GITHUB_OAUTH_SCOPE=repo read:user
```

Depois de alterar variáveis, faça um **Redeploy**.

## Usar upload múltiplo

### Pelo botão

1. Abra o repositório, a branch e a pasta de destino.
2. Clique em **Upload múltiplo**.
3. Use **Selecionar arquivos** para escolher vários arquivos ou **Selecionar pasta** para importar um diretório completo.
4. Também é possível fazer outras seleções: os itens são adicionados à fila.
5. Confira os caminhos, informe a mensagem do commit e clique em **Enviar e confirmar**.

### Arrastando e soltando

- Solte arquivos ou pastas na área pontilhada da janela de upload; ou
- Solte-os diretamente sobre a lista de arquivos do projeto. A pasta atualmente aberta será usada como destino.

### Arquivos já existentes

A aplicação marca conflitos antes de enviar. Por padrão, nenhum arquivo existente é sobrescrito. Para substituir arquivos com o mesmo caminho, marque:

```text
Substituir arquivos que já existirem no mesmo caminho
```

### Estrutura de pastas

Ao selecionar ou arrastar uma pasta, a estrutura relativa é preservada. Exemplo:

```text
meu-site/
├── index.html
├── css/style.css
└── imagens/logo.png
```

O Git não armazena diretórios vazios. Para manter uma pasta sem conteúdo, adicione um arquivo como `.gitkeep` dentro dela.

## Outras funções

### Criar repositório

Clique no botão `＋` ao lado de **Repositórios**, informe nome, descrição e visibilidade. A inicialização com README continua recomendada, mas a versão 2.1.1 também consegue fazer o primeiro upload em um repositório totalmente vazio.

### Criar branch

Selecione a branch de origem, clique em **＋ Branch**, informe o nome e confirme.

### Abrir Pull Request

Clique em **Pull Request**, escolha origem e destino, informe título e descrição e confirme.

### Renomear, mover ou copiar

Abra um arquivo, clique em **Mover/copiar**, escolha a operação, informe o novo caminho e a mensagem do commit.

### Pesquisa rápida

Clique em **⌕ Buscar** ou pressione `Ctrl + P`. Use as setas e `Enter` para navegar.

## Scripts

```bash
npm run dev
npm start
npm run check
npm test
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
| `GITHUB_API_URL` | Não | Padrão: `https://api.github.com`. |
| `PORT` | Não | Porta local; padrão `3000`. |

## Limites e comportamento

- Até 500 arquivos por operação.
- Até 3 MB por arquivo nesta aplicação.
- O limite por arquivo mantém cada requisição abaixo do limite de payload da Vercel após codificação Base64.
- O upload pode gerar vários blobs temporários, mas apenas um commit é criado para a operação completa.
- Se a branch mudar durante o envio, o commit é cancelado para não apagar alterações concorrentes.
- Leitura no editor: até 5 MB.
- Diretórios vazios não existem no Git.
- Mover/copiar continua destinado a arquivos individuais; upload aceita árvores completas de pastas.
- Em repositórios extremamente grandes, o índice recursivo da API pode ser parcial e a validação de conflitos pode fazer consultas adicionais.

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
- Normalização de caminhos, branches e repositórios.
- Validação de SHA e do estado da branch antes de criar commits.
- Atualizações de referência sem `force`.
- Respostas da API com `Cache-Control: no-store`.
