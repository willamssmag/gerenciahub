# Atualização 3.0 — Central de Projetos

## Mudança principal

A URL principal agora abre uma homepage de projetos. O GitHub File Manager original foi mantido em:

```text
/gerenciahub/
```

## Novos arquivos públicos

- `public/index.html`: homepage
- `public/data.js`: projetos iniciais
- `public/html.html`: editor e visualizador de código
- `public/projects.json`: projetos publicados pelo editor
- `public/gerenciahub/`: aplicação original completa

## Atenção ao OAuth

A Callback URL do GitHub continua terminando em:

```text
/api/auth/callback
```

Não altere para `/gerenciahub/api/...`. O backend continua na raiz e, após o login, redireciona para `/gerenciahub/`.
