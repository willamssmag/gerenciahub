# Central de Projetos + GerenciaHub

Esta versão aproveita o GerenciaHub existente e acrescenta uma nova página inicial para reunir todos os projetos em um único endereço.

## Endereços após publicar

- `/` — página inicial da Central de Projetos
- `/gerenciahub/` — aplicativo GitHub File Manager completo
- `/html.html` — visualizador/editor de código
- `/projetos/<id>/` — páginas publicadas pelo editor

No domínio atual, os principais endereços ficarão assim:

```text
https://gerenciahub.vercel.app/
https://gerenciahub.vercel.app/gerenciahub/
https://gerenciahub.vercel.app/html.html
```

## O que foi mantido

O GerenciaHub continua com autenticação via GitHub OAuth ou token, navegação por repositórios, edição, commits, upload múltiplo, branches, Pull Requests, criação de repositórios e organização de arquivos.

As rotas da API continuam em `/api/...`, portanto mover a interface para `/gerenciahub/` não altera o backend. O retorno do OAuth foi ajustado para abrir novamente o aplicativo nessa pasta.

## Adicionar projetos à página inicial

Existem duas formas:

1. Edite `public/data.js` e acrescente um objeto em `window.PROJECTS`.
2. Abra `/html.html`, cole o código e use **Salvar em Meus Projetos** ou **Publicar online**.

Projetos salvos localmente ficam somente no navegador atual. Projetos publicados online são gravados em `public/projects.json` e em `public/projetos/<id>/`.

## Configurar a publicação online

Além das variáveis já usadas pelo GerenciaHub, cadastre na Vercel:

```text
GITHUB_TOKEN=token_fine_grained
GITHUB_OWNER=seu_usuario
GITHUB_REPO=nome_deste_repositorio
GITHUB_BRANCH=main
ADMIN_PASSWORD=uma_senha_forte
```

O `GITHUB_TOKEN` precisa ter acesso somente a este repositório e permissão **Contents: Read and write**.

## Variáveis do GerenciaHub

```text
SESSION_SECRET=uma_chave_longa_com_mais_de_24_caracteres
GITHUB_CLIENT_ID=opcional_para_oauth
GITHUB_CLIENT_SECRET=opcional_para_oauth
APP_URL=https://gerenciahub.vercel.app
GITHUB_OAUTH_SCOPE=repo read:user
```

Sem OAuth configurado, o login por Personal Access Token continua disponível.

## Publicar a atualização

1. Substitua os arquivos do repositório pelos desta versão.
2. Faça commit e push para a branch conectada à Vercel.
3. Confirme as variáveis de ambiente.
4. Faça um novo deploy.

A URL principal passará a mostrar a Central de Projetos. O aplicativo antigo ficará acessível pelo cartão **GerenciaHub** ou diretamente por `/gerenciahub/`.

## Rodar localmente

```bash
npm install
cp .env.example .env
npm run dev
```

Abra `http://localhost:3000`.
