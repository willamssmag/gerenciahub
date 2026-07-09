# Atualização 4.1 — busca de arquivos e barra lateral simplificada

## Mudanças principais

- A barra lateral do GerenciaHub foi ajustada para mostrar somente o nome do repositório/projeto.
- O formato `usuario/meuprojeto` não aparece mais na lista lateral.
- A busca lateral de repositórios continua encontrando pelo nome simples, nome completo e descrição.
- Foi adicionada uma barra fixa de pesquisa na área **Arquivos**.
- A nova busca localiza arquivos e pastas no repositório inteiro, não apenas na pasta aberta.
- Ao selecionar um resultado, o GerenciaHub abre automaticamente a pasta do arquivo e carrega o conteúdo no editor.
- A pesquisa por **Ctrl + P** continua disponível.

## Arquivos alterados

```text
public/gerenciahub/index.html
public/gerenciahub/app.js
public/gerenciahub/styles.css
README.md
ATUALIZACAO.md
package.json
package-lock.json
```

## Validação

- `npm run check` passou sem erros.
- `npm test` passou com 3 testes aprovados.
