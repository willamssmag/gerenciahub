# GerenciaHub Portfolio — versão 4.1

Central pessoal de projetos com cada aplicativo isolado em sua própria pasta dentro de `public/`.

## Novidades da versão 4.1

- A barra lateral do GerenciaHub agora mostra apenas o nome do projeto/repositório, sem o formato `usuario/repositorio`.
- A área **Arquivos** ganhou uma barra fixa de pesquisa para localizar arquivos e pastas no repositório inteiro.
- Ao clicar em um resultado da busca, o sistema abre automaticamente a pasta correta e carrega o arquivo para edição.
- A busca aceita parte do nome, extensão ou caminho, por exemplo: `index`, `app.js`, `public`, `css` ou `visualizador/editor`.
- O atalho antigo **Ctrl + P** continua funcionando como pesquisa rápida em janela.

## Estrutura

```text
public/
├── index.html                 # entrada da Central de Projetos
├── portfolio/                 # arquivos exclusivos da página inicial
│   ├── data.js
│   ├── script.js
│   ├── storage.js
│   └── styles.css
├── gerenciahub/               # projeto GerenciaHub completo e independente
│   ├── index.html
│   ├── app.js
│   ├── styles.css
│   └── project.json
├── visualizador/              # editor/visualizador completo e independente
│   ├── index.html
│   ├── editor.js
│   ├── editor.css
│   ├── project.html
│   ├── project.js
│   ├── storage.js
│   ├── styles.css
│   └── project.json
└── projetos/                  # projetos criados pelo visualizador
    └── nome-do-projeto/
        ├── index.html
        ├── source.txt
        └── project.json
```

## Como funciona a atualização isolada

Ao publicar um projeto novo, o sistema cria uma pasta em:

```text
public/projetos/identificador-do-projeto/
```

Ao abrir **Editar** e publicar novamente, o backend altera somente:

```text
public/projetos/identificador-do-projeto/index.html
public/projetos/identificador-do-projeto/source.txt
public/projetos/identificador-do-projeto/project.json
```

A página inicial, o GerenciaHub, o Visualizador e as pastas dos outros projetos não são regravados.
O identificador da pasta fica bloqueado durante a edição para impedir que uma atualização seja enviada acidentalmente para outra pasta.

## Endereços

```text
/                         Central de Projetos
/gerenciahub/             GerenciaHub
/visualizador/            Visualizador e editor
/projetos/nome/           Projeto publicado
```

Os endereços antigos `/html` e `/html.html` continuam funcionando e redirecionam internamente para `/visualizador/`.

## Variáveis da Vercel

Configure em **Vercel → Settings → Environment Variables**:

```env
GITHUB_TOKEN=seu_token_do_github
GITHUB_OWNER=seu_usuario
GITHUB_REPO=nome_do_repositorio
GITHUB_BRANCH=main
ADMIN_PASSWORD=uma_senha_forte
SESSION_SECRET=uma_chave_aleatoria_com_mais_de_24_caracteres
```

O token precisa de permissão de leitura e escrita em **Contents** no repositório usado pelo site.

## Publicar a atualização

1. Extraia o ZIP.
2. Substitua os arquivos do repositório pelos arquivos desta versão.
3. Confirme que as pastas `public/portfolio`, `public/gerenciahub` e `public/visualizador` foram enviadas completas.
4. Faça commit na branch conectada à Vercel.
5. Aguarde o deploy automático.

## Atualizar manualmente um projeto

Para atualizar o GerenciaHub, altere apenas `public/gerenciahub/`.

Para atualizar o Visualizador, altere apenas `public/visualizador/`.

Para atualizar um projeto publicado, altere apenas `public/projetos/nome-do-projeto/` ou use o botão **Editar** na página inicial.

## Compatibilidade com a versão anterior

O backend ainda consegue ler o antigo `public/projects.json`, caso ele exista no repositório. Porém, esse arquivo não é mais escrito nem atualizado. Todo novo cadastro passa a usar o `project.json` localizado dentro da pasta individual do projeto.

## Desenvolvimento local

```bash
npm install
npm run dev
```

Abra `http://localhost:3000`.

## Verificações

```bash
npm run check
npm test
```
